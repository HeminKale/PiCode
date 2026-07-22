from __future__ import annotations

import csv
import io
from typing import Any

MAX_CSV_BYTES = 10 * 1024 * 1024
MAX_CSV_DATA_ROWS = 15_000


class CsvProfileError(ValueError):
    pass


def _decode_csv(payload: bytes) -> tuple[str, str]:
    if len(payload) > MAX_CSV_BYTES:
        raise CsvProfileError("CSV versions are limited to 10 MB.")
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return payload.decode(encoding), encoding
        except UnicodeDecodeError:
            pass
    raise CsvProfileError("CSV must use UTF-8 or UTF-8 with BOM encoding.")


def _infer_type(values: list[str]) -> str:
    populated = [value.strip() for value in values if value.strip()]
    if not populated:
        return "unknown"
    lowered = {value.lower() for value in populated}
    if lowered <= {"true", "false", "yes", "no"}:
        return "boolean"
    try:
        for value in populated:
            float(value)
        return "number"
    except ValueError:
        return "string"


def profile_csv(payload: bytes) -> dict[str, Any]:
    text, encoding = _decode_csv(payload)
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    try:
        header = next(reader)
    except StopIteration as error:
        raise CsvProfileError("CSV is empty.") from error
    header = [name.strip() for name in header]
    if not all(header) or len(set(header)) != len(header):
        raise CsvProfileError("CSV must contain a unique, non-empty header row.")
    rows: list[list[str]] = []
    for row in reader:
        if not any(cell.strip() for cell in row):
            continue
        if len(row) != len(header):
            raise CsvProfileError("CSV row has a different number of columns than its header.")
        rows.append(row)
        if len(rows) > MAX_CSV_DATA_ROWS:
            raise CsvProfileError("CSV versions are limited to 15,000 data rows.")
    columns = []
    for index, name in enumerate(header):
        values = [row[index] for row in rows]
        columns.append({
            "name": name,
            "inferredType": _infer_type(values),
            "nullCount": sum(not value.strip() for value in values),
        })
    return {
        "encoding": encoding,
        "delimiter": dialect.delimiter,
        "hasHeader": True,
        "dataRowCount": len(rows),
        "columns": columns,
        "warnings": [],
    }
