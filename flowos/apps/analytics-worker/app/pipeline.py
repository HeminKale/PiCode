from __future__ import annotations

import csv
import io
import math
import re
from collections import defaultdict
from typing import Any

from .profiling import CsvProfileError, _decode_csv


class PipelineError(ValueError):
    pass


Table = list[dict[str, Any]]


def _read_csv(payload: bytes) -> Table:
    text, _ = _decode_csv(payload)
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames or any(not name.strip() for name in reader.fieldnames):
        raise PipelineError("CSV input requires a non-empty header row.")
    rows = [{key.strip(): value.strip() if value is not None else None for key, value in row.items()} for row in reader]
    if len(rows) > 15_000:
        raise PipelineError("Processed datasets are limited to 15,000 rows.")
    return rows


def _copy(rows: Table) -> Table:
    return [dict(row) for row in rows]


def _require_columns(rows: Table, columns: list[str], node_id: str) -> None:
    actual = set().union(*(row.keys() for row in rows)) if rows else set()
    missing = [column for column in columns if column not in actual]
    if missing:
        raise PipelineError(f"{node_id}: required columns are missing: {', '.join(missing)}")


def _as_number(value: Any, node_id: str, column: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as error:
        raise PipelineError(f"{node_id}: {column} must be numeric.") from error


def _filter(rows: Table, config: dict[str, Any], node_id: str) -> Table:
    column, operator, expected = config.get("column"), config.get("operator"), config.get("value")
    if not isinstance(column, str) or operator not in {"equals", "not_equals", "gt", "gte", "lt", "lte", "is_missing", "is_present"}:
        raise PipelineError(f"{node_id}: filter configuration is not allow-listed.")
    _require_columns(rows, [column], node_id)
    def matches(value: Any) -> bool:
        if operator == "is_missing": return value is None or value == ""
        if operator == "is_present": return value is not None and value != ""
        if operator in {"gt", "gte", "lt", "lte"}:
            actual = _as_number(value, node_id, column)
            comparator = _as_number(expected, node_id, column)
            if actual is None or comparator is None: return False
            return {"gt": actual > comparator, "gte": actual >= comparator, "lt": actual < comparator, "lte": actual <= comparator}[operator]
        return value == expected if operator == "equals" else value != expected
    return [row for row in rows if matches(row.get(column))]


def _deduplicate(rows: Table, config: dict[str, Any], node_id: str) -> Table:
    keys = config.get("keys")
    policy = config.get("policy", "reject")
    if not isinstance(keys, list) or not keys or policy not in {"reject", "aggregate"}:
        raise PipelineError(f"{node_id}: deduplicate needs keys and an explicit reject or aggregate policy.")
    _require_columns(rows, keys, node_id)
    grouped: dict[tuple[Any, ...], Table] = defaultdict(list)
    for row in rows: grouped[tuple(row.get(key) for key in keys)].append(row)
    duplicates = [group for group in grouped.values() if len(group) > 1]
    if duplicates and policy == "reject":
        raise PipelineError(f"{node_id}: duplicate keys found; choose an explicit aggregate policy to combine them.")
    if not duplicates: return _copy(rows)
    aggregations = config.get("aggregations", {})
    if not isinstance(aggregations, dict) or not aggregations:
        raise PipelineError(f"{node_id}: aggregate deduplication needs explicit numeric aggregations.")
    result: Table = []
    for group in grouped.values():
        row = dict(group[0])
        for column, operation in aggregations.items():
            if operation != "sum": raise PipelineError(f"{node_id}: only the reviewed sum aggregation is available.")
            row[column] = sum(_as_number(item.get(column), node_id, column) or 0 for item in group)
        result.append(row)
    return result


def _join(left: Table, right: Table, config: dict[str, Any], node_id: str, findings: list[dict[str, Any]]) -> Table:
    left_keys, right_keys = config.get("leftKeys"), config.get("rightKeys")
    join_type = config.get("joinType", "inner")
    duplicate_policy = config.get("duplicateKeyPolicy", "reject")
    if not isinstance(left_keys, list) or not isinstance(right_keys, list) or not left_keys or len(left_keys) != len(right_keys):
        raise PipelineError(f"{node_id}: join needs matching leftKeys and rightKeys.")
    if join_type not in {"inner", "left", "right", "full", "semi", "anti"} or duplicate_policy != "reject":
        raise PipelineError(f"{node_id}: join type or duplicate-key policy is not supported.")
    _require_columns(left, left_keys, node_id); _require_columns(right, right_keys, node_id)
    index: dict[tuple[Any, ...], Table] = defaultdict(list)
    for row in right: index[tuple(row.get(key) for key in right_keys)].append(row)
    if any(len(matches) > 1 for matches in index.values()):
        raise PipelineError(f"{node_id}: right-side join keys are duplicated; declare a pipeline aggregation first.")
    right_columns = set().union(*(row.keys() for row in right)) if right else set()
    result: Table = []; matched_right: set[tuple[Any, ...]] = set(); unmatched_left = 0
    for row in left:
        key = tuple(row.get(column) for column in left_keys); matches = index.get(key, [])
        if not matches:
            unmatched_left += 1
            if join_type == "anti": result.append(dict(row))
            elif join_type in {"left", "full"}:
                result.append({**row, **{column: None for column in right_columns if column not in row}})
            continue
        matched_right.add(key)
        if join_type == "anti": continue
        if join_type == "semi": result.append(dict(row)); continue
        result.append({**row, **matches[0]})
    if join_type in {"right", "full"}:
        left_columns = set().union(*(row.keys() for row in left)) if left else set()
        for key, matches in index.items():
            if key not in matched_right:
                result.append({**{column: None for column in left_columns if column not in matches[0]}, **matches[0]})
    if unmatched_left and config.get("reportMissingMatch", False):
        findings.append({"code": "missing_calendar_match", "severity": "warning", "count": unmatched_left, "message": f"{unmatched_left} source rows had no matching join row."})
    return result


def _quality_report(input_rows: int, rows: Table, findings: list[dict[str, Any]]) -> dict[str, Any]:
    columns = set().union(*(row.keys() for row in rows)) if rows else set()
    for column in columns:
        null_count = sum(row.get(column) is None or row.get(column) == "" for row in rows)
        if null_count:
            findings.append({"code": "null_rate", "severity": "info", "column": column, "count": null_count, "message": f"{column} has {null_count} missing values."})
    if "week_num" in columns:
        invalid = sum(not re.match(r"^\d{4}-(?:W)?\d{1,2}$", str(row.get("week_num") or "")) for row in rows)
        if invalid: findings.append({"code": "invalid_week", "severity": "warning", "column": "week_num", "count": invalid, "message": "Week values should use YYYY-WW or YYYY-Www."})
    if "sales_units" in columns:
        negative = sum((_as_number(row.get("sales_units"), "quality", "sales_units") or 0) < 0 for row in rows)
        if negative: findings.append({"code": "negative_units", "severity": "error", "column": "sales_units", "count": negative, "message": "Sales units cannot be negative."})
    if "promotion_intensity" in columns:
        invalid = sum((value is not None and value != "" and ((_as_number(value, "quality", "promotion_intensity") or 0) < 0 or (_as_number(value, "quality", "promotion_intensity") or 0) > 1)) for value in (row.get("promotion_intensity") for row in rows))
        if invalid: findings.append({"code": "invalid_promotion_intensity", "severity": "error", "column": "promotion_intensity", "count": invalid, "message": "Promotion intensity must be numeric from 0 to 1."})
    for column in ("sales_units", "sales_dollars", "consumer_price"):
        if column not in columns:
            continue
        values = [_as_number(row.get(column), "quality", column) for row in rows]
        numeric_values = [value for value in values if value is not None]
        if len(numeric_values) < 4:
            continue
        mean = sum(numeric_values) / len(numeric_values)
        variance = sum((value - mean) ** 2 for value in numeric_values) / len(numeric_values)
        deviation = math.sqrt(variance)
        if deviation == 0:
            continue
        outlier_count = sum(abs(value - mean) > 3 * deviation for value in numeric_values)
        if outlier_count:
            findings.append({"code": "outlier", "severity": "warning", "column": column, "count": outlier_count, "message": f"{column} has values more than three standard deviations from its mean."})
    return {"inputRowCount": input_rows, "outputRowCount": len(rows), "findings": findings}


def run_pipeline(sources: dict[str, bytes], pipeline: dict[str, Any]) -> dict[str, Any]:
    """Run only reviewed declarative operations; no formulas or user code are evaluated."""
    nodes = pipeline.get("nodes")
    if pipeline.get("contractVersion") != "analytics.v1" or not isinstance(nodes, list):
        raise PipelineError("Pipeline must use the analytics.v1 contract and a node list.")
    outputs: dict[str, Table] = {}; findings: list[dict[str, Any]] = []; input_rows = 0
    for node in nodes:
        node_id, node_type, config = node.get("id"), node.get("type"), node.get("config", {})
        input_ids = node.get("inputIds", [])
        if not isinstance(node_id, str) or not isinstance(config, dict) or not isinstance(input_ids, list):
            raise PipelineError("Every pipeline node needs id, inputIds, and object config.")
        inputs = [outputs[input_id] for input_id in input_ids if input_id in outputs]
        if len(inputs) != len(input_ids): raise PipelineError(f"{node_id}: input node is unavailable.")
        if node_type == "CSV_INPUT":
            source_id = config.get("sourceId")
            if not isinstance(source_id, str) or source_id not in sources: raise PipelineError(f"{node_id}: sourceId is unavailable.")
            output = _read_csv(sources[source_id]); input_rows += len(output)
        elif node_type == "SCHEMA_VALIDATE":
            output = _copy(inputs[0]); _require_columns(output, config.get("requiredColumns", []), node_id)
        elif node_type == "CAST_COLUMNS":
            output = _copy(inputs[0])
            for column, type_name in config.get("columns", {}).items():
                _require_columns(output, [column], node_id)
                if type_name == "number":
                    for row in output: row[column] = _as_number(row.get(column), node_id, column)
                elif type_name != "string": raise PipelineError(f"{node_id}: only string and number casts are available.")
        elif node_type == "RENAME_COLUMNS":
            output = [{config.get("mappings", {}).get(key, key): value for key, value in row.items()} for row in inputs[0]]
        elif node_type == "SELECT_COLUMNS":
            columns = config.get("columns", []); _require_columns(inputs[0], columns, node_id); output = [{column: row.get(column) for column in columns} for row in inputs[0]]
        elif node_type == "DROP_COLUMNS":
            dropped = set(config.get("columns", [])); output = [{key: value for key, value in row.items() if key not in dropped} for row in inputs[0]]
        elif node_type == "FILTER_ROWS": output = _filter(inputs[0], config, node_id)
        elif node_type == "DERIVE_COLUMN":
            output = _copy(inputs[0]); source, target = config.get("sourceColumn"), config.get("targetColumn")
            if config.get("operation") != "reported_indicator" or not isinstance(source, str) or not isinstance(target, str): raise PipelineError(f"{node_id}: only reported_indicator derivation is available.")
            _require_columns(output, [source], node_id)
            for row in output: row[target] = 0 if row.get(source) is None or row.get(source) == "" else 1
        elif node_type == "HANDLE_MISSING":
            output = _copy(inputs[0])
            for policy in config.get("policies", []):
                column, strategy = policy.get("column"), policy.get("strategy")
                if strategy == "constant":
                    for row in output:
                        if row.get(column) is None or row.get(column) == "": row[column] = policy.get("value")
                elif strategy == "drop": output = [row for row in output if row.get(column) not in (None, "")]
                else: raise PipelineError(f"{node_id}: missing-value strategy is not allow-listed.")
        elif node_type == "DEDUPLICATE": output = _deduplicate(inputs[0], config, node_id)
        elif node_type == "APPEND": output = [row for table in inputs for row in _copy(table)]
        elif node_type == "JOIN": output = _join(inputs[0], inputs[1], config, node_id, findings)
        elif node_type == "AGGREGATE": output = _deduplicate(inputs[0], {"keys": config.get("groupBy"), "policy": "aggregate", "aggregations": config.get("measures")}, node_id)
        elif node_type == "SORT":
            columns = config.get("columns", []); _require_columns(inputs[0], columns, node_id); output = sorted(_copy(inputs[0]), key=lambda row: tuple("" if row.get(column) is None else row.get(column) for column in columns), reverse=config.get("direction") == "desc")
        elif node_type == "OUTPUT_DATASET": output = _copy(inputs[0])
        else: raise PipelineError(f"{node_id}: unrecognised fixed pipeline node {node_type}.")
        outputs[node_id] = output
    if not nodes: raise PipelineError("Pipeline contains no nodes.")
    return {"rows": outputs[nodes[-1]["id"]], "qualityReport": _quality_report(input_rows, outputs[nodes[-1]["id"]], findings)}


def write_csv(rows: Table) -> bytes:
    """Serialize fixed pipeline output without carrying raw data into job metadata."""
    if len(rows) > 15_000:
        raise PipelineError("Processed datasets are limited to 15,000 rows.")
    columns = list(dict.fromkeys(key for row in rows for key in row.keys()))
    if not columns:
        raise PipelineError("Pipeline output must contain at least one column.")
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")
