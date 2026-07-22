from __future__ import annotations

import hashlib
import json
import math
import statistics
from collections import defaultdict
from typing import Any

from .pipeline import PipelineError, Table, _read_csv, write_csv


MODEL_ORDER = ("ridge_linear", "poisson_glm", "histogram_gradient_boosting")
LEAKAGE_COLUMNS = {"sales_units", "sales_dollars", "baseline_units"}
IDENTIFIER_COLUMNS = {"product_id", "customer_id", "week_num", "week_start", "week_end"}


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _week_parts(value: Any) -> tuple[float, float]:
    text = str(value or "")
    try:
        year, week = text.replace("W", "").split("-", 1)
        return float(year), float(week)
    except ValueError:
        return 0.0, 0.0


def _value_for_feature(row: dict[str, Any], feature: str) -> float | None:
    if feature == "calendar_year":
        return _week_parts(row.get("week_num"))[0]
    if feature == "calendar_week":
        return _week_parts(row.get("week_num"))[1]
    return _number(row.get(feature))


def _feature_names(rows: Table, include_baseline_units: bool) -> list[str]:
    columns = set().union(*(row.keys() for row in rows))
    candidates = sorted(columns - IDENTIFIER_COLUMNS - {"sales_units", "sales_dollars"})
    if not include_baseline_units:
        candidates = [column for column in candidates if column != "baseline_units"]
    numeric = [column for column in candidates if any(_number(row.get(column)) is not None for row in rows)]
    # Week components are deterministic calendar features, never raw target outcomes.
    return numeric + ["calendar_year", "calendar_week"]


def _defaults(rows: Table, features: list[str]) -> dict[str, float]:
    defaults: dict[str, float] = {}
    for feature in features:
        values = [value for row in rows if (value := _value_for_feature(row, feature)) is not None]
        defaults[feature] = float(statistics.median(values)) if values else 0.0
    return defaults


def _vector(row: dict[str, Any], features: list[str], defaults: dict[str, float]) -> list[float]:
    return [defaults[feature] if (value := _value_for_feature(row, feature)) is None else value for feature in features]


def _solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Solve a small reviewed normal-equation system without executing user code."""
    size = len(vector)
    augmented = [matrix[index][:] + [vector[index]] for index in range(size)]
    for pivot in range(size):
        best = max(range(pivot, size), key=lambda index: abs(augmented[index][pivot]))
        if abs(augmented[best][pivot]) < 1e-10:
            augmented[best][pivot] = 1e-10
        augmented[pivot], augmented[best] = augmented[best], augmented[pivot]
        divisor = augmented[pivot][pivot]
        augmented[pivot] = [value / divisor for value in augmented[pivot]]
        for row_index in range(size):
            if row_index == pivot:
                continue
            multiplier = augmented[row_index][pivot]
            augmented[row_index] = [value - multiplier * pivot_value for value, pivot_value in zip(augmented[row_index], augmented[pivot])]
    return [augmented[index][-1] for index in range(size)]


def _fit_ridge(x_rows: list[list[float]], y_rows: list[float], features: list[str], defaults: dict[str, float], family: str = "ridge_linear") -> dict[str, Any]:
    means = [sum(row[index] for row in x_rows) / len(x_rows) for index in range(len(features))]
    scales = [max(math.sqrt(sum((row[index] - means[index]) ** 2 for row in x_rows) / len(x_rows)), 1e-6) for index in range(len(features))]
    normalized = [[1.0] + [(value - means[index]) / scales[index] for index, value in enumerate(row)] for row in x_rows]
    size = len(features) + 1
    matrix = [[sum(row[left] * row[right] for row in normalized) for right in range(size)] for left in range(size)]
    for index in range(1, size):
        matrix[index][index] += 1.0
    target = [sum(row[index] * value for row, value in zip(normalized, y_rows)) for index in range(size)]
    return {"family": family, "features": features, "defaults": defaults, "means": means, "scales": scales, "weights": _solve(matrix, target)}


def _predict_ridge(model: dict[str, Any], vector: list[float]) -> float:
    normalized = [1.0] + [(value - model["means"][index]) / model["scales"][index] for index, value in enumerate(vector)]
    value = sum(weight * item for weight, item in zip(model["weights"], normalized))
    if model["family"] == "poisson_glm":
        return max(0.0, math.exp(min(value, 20.0)) - 1.0)
    return max(0.0, value)


def _fit_histogram_gradient_boosting(x_rows: list[list[float]], y_rows: list[float], features: list[str], defaults: dict[str, float]) -> dict[str, Any]:
    base = sum(y_rows) / len(y_rows)
    predictions = [base] * len(y_rows)
    stumps: list[dict[str, float]] = []
    for _ in range(24):
        residuals = [target - prediction for target, prediction in zip(y_rows, predictions)]
        best: tuple[float, dict[str, float]] | None = None
        for feature_index in range(len(features)):
            values = sorted({row[feature_index] for row in x_rows})
            if len(values) < 2:
                continue
            thresholds = [values[min(len(values) - 1, round((len(values) - 1) * quantile / 8))] for quantile in range(1, 8)]
            for threshold in set(thresholds):
                left = [residual for row, residual in zip(x_rows, residuals) if row[feature_index] <= threshold]
                right = [residual for row, residual in zip(x_rows, residuals) if row[feature_index] > threshold]
                if not left or not right:
                    continue
                left_value, right_value = sum(left) / len(left), sum(right) / len(right)
                gain = sum((left_value if row[feature_index] <= threshold else right_value) * residual for row, residual in zip(x_rows, residuals))
                stump = {"featureIndex": float(feature_index), "threshold": threshold, "left": left_value * 0.15, "right": right_value * 0.15}
                if best is None or gain > best[0]:
                    best = (gain, stump)
        if best is None or best[0] <= 1e-8:
            break
        stump = best[1]
        stumps.append(stump)
        index = int(stump["featureIndex"])
        predictions = [prediction + (stump["left"] if row[index] <= stump["threshold"] else stump["right"]) for row, prediction in zip(x_rows, predictions)]
    return {"family": "histogram_gradient_boosting", "features": features, "defaults": defaults, "base": base, "stumps": stumps}


def _predict(model: dict[str, Any], row: dict[str, Any]) -> float:
    vector = _vector(row, model["features"], model["defaults"])
    if model["family"] in {"ridge_linear", "poisson_glm"}:
        return _predict_ridge(model, vector)
    prediction = model["base"]
    for stump in model["stumps"]:
        prediction += stump["left"] if vector[int(stump["featureIndex"])] <= stump["threshold"] else stump["right"]
    return max(0.0, prediction)


def _metrics(actual: list[float], predicted: list[float]) -> dict[str, float]:
    if not actual:
        raise PipelineError("A validation set with sales_units is required.")
    errors = [estimate - target for target, estimate in zip(actual, predicted)]
    denominator = max(sum(abs(value) for value in actual), 1e-6)
    mean = sum(actual) / len(actual)
    total = sum((value - mean) ** 2 for value in actual)
    return {
        "wape": 100 * sum(abs(value) for value in errors) / denominator,
        "mae": sum(abs(value) for value in errors) / len(errors),
        "rmse": math.sqrt(sum(value * value for value in errors) / len(errors)),
        "r2": 1 - sum(value * value for value in errors) / total if total > 1e-9 else 0.0,
        "bias": sum(errors) / len(errors),
    }


def _segment_metrics(rows: Table, predictions: list[float]) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    for column in ("product_id", "customer_id"):
        groups: dict[str, list[tuple[float, float]]] = defaultdict(list)
        for row, prediction in zip(rows, predictions):
            if (actual := _number(row.get("sales_units"))) is not None and row.get(column) is not None:
                groups[str(row[column])].append((actual, prediction))
        for value, pairs in groups.items():
            result[f"{column}:{value}"] = _metrics([pair[0] for pair in pairs], [pair[1] for pair in pairs])
    return result


def _split_by_time(rows: Table, validation_weeks: int | None) -> tuple[Table, Table]:
    weeks = sorted({str(row.get("week_num") or "") for row in rows if str(row.get("week_num") or "")})
    if len(weeks) < 2:
        raise PipelineError("Training requires at least two distinct week_num values for a time split.")
    count = validation_weeks or max(1, math.ceil(len(weeks) * 0.2))
    if count >= len(weeks):
        raise PipelineError("Validation weeks must leave at least one earlier training week.")
    validation = set(weeks[-count:])
    return [row for row in rows if str(row.get("week_num")) not in validation], [row for row in rows if str(row.get("week_num")) in validation]


def train_model(payload: bytes, request: dict[str, Any]) -> dict[str, Any]:
    rows = _read_csv(payload)
    if not rows:
        raise PipelineError("The processed training dataset is empty.")
    if any(_number(row.get("sales_units")) is None for row in rows):
        raise PipelineError("Training requires numeric sales_units for every row.")
    for row in rows:
        promotion = _number(row.get("promotion_intensity"))
        if promotion is not None and not 0 <= promotion <= 1:
            raise PipelineError("Training requires promotion_intensity on the confirmed 0–1 scale.")
        for number in range(1, 11):
            tactic = _number(row.get(f"tactic_{number:02d}_intensity"))
            if tactic is not None and not 0 <= tactic <= 1:
                raise PipelineError("Training requires supplied tactic intensities on the 0–1 scale.")
    features = _feature_names(rows, bool(request.get("includeBaselineUnits", False)))
    if not features:
        raise PipelineError("Training needs at least one numeric pre-outcome feature.")
    train_rows, validation_rows = _split_by_time(rows, request.get("validationWeeks"))
    defaults = _defaults(train_rows, features)
    x_train = [_vector(row, features, defaults) for row in train_rows]
    y_train = [float(_number(row["sales_units"])) for row in train_rows]
    candidates = request.get("candidateAlgorithms") or list(MODEL_ORDER)
    if any(candidate not in MODEL_ORDER for candidate in candidates):
        raise PipelineError("Only reviewed fixed model algorithms are available.")
    evaluations: list[dict[str, Any]] = []
    for family in MODEL_ORDER:
        if family not in candidates:
            continue
        model = _fit_histogram_gradient_boosting(x_train, y_train, features, defaults) if family == "histogram_gradient_boosting" else _fit_ridge(x_train, [math.log1p(value) for value in y_train] if family == "poisson_glm" else y_train, features, defaults, family)
        predictions = [_predict(model, row) for row in validation_rows]
        actual = [float(_number(row["sales_units"])) for row in validation_rows]
        evaluations.append({"algorithm": family, "metrics": _metrics(actual, predictions), "segmentErrors": _segment_metrics(validation_rows, predictions), "model": model})
    if not evaluations:
        raise PipelineError("Choose at least one fixed model algorithm.")
    max_wape = float((request.get("thresholds") or {}).get("maxWape", 100.0))
    qualified = [evaluation for evaluation in evaluations if evaluation["metrics"]["wape"] <= max_wape]
    selected = qualified[0] if qualified else min(evaluations, key=lambda evaluation: evaluation["metrics"]["wape"])
    fingerprint = hashlib.sha256(payload).hexdigest()
    model = {**selected["model"], "contractVersion": "analytics.v1", "target": "sales_units", "featureSetVersion": "analytics.feature-set.v1", "trainingDataFingerprint": fingerprint, "validationWeeks": len({str(row.get("week_num")) for row in validation_rows})}
    return {
        "model": model,
        "modelFamily": selected["algorithm"],
        "metrics": selected["metrics"],
        "evaluations": [{key: value for key, value in evaluation.items() if key != "model"} | {"selected": evaluation is selected} for evaluation in evaluations],
        "isApproved": selected in qualified,
        "dataFingerprint": fingerprint,
        "featureSet": {"version": "analytics.feature-set.v1", "target": "sales_units", "features": features, "excludedByDefault": ["baseline_units", "sales_dollars"] if not request.get("includeBaselineUnits", False) else ["sales_dollars"]},
    }


def _apply_tactics(row: dict[str, Any], tactics: dict[str, Any] | None) -> None:
    for number in range(1, 11):
        intensity = f"tactic_{number:02d}_intensity"
        reported = f"tactic_{number:02d}_reported"
        value = (tactics or {}).get(intensity)
        if value is None:
            row[reported] = 0
            row[intensity] = None
            continue
        numeric = _number(value)
        if numeric is None or numeric < 0 or numeric > 1:
            raise PipelineError(f"{intensity} must be a numeric intensity from 0 to 1 when supplied.")
        row[intensity] = numeric
        row[reported] = 1


def _scenario_rows(history: Table, scenario: dict[str, Any]) -> Table:
    if scenario.get("mode") == "historical_what_if":
        customer_id = scenario.get("customerId")
        products = set(scenario.get("productIds") or [])
        weeks = set(scenario.get("weekNums") or [])
        selected = [dict(row) for row in history if row.get("customer_id") == customer_id and (not products or row.get("product_id") in products) and (not weeks or row.get("week_num") in weeks)]
        if not selected:
            raise PipelineError("No historical rows match the requested customer, product, and week scope.")
        for row in selected:
            row["promotion_intensity"] = scenario.get("promotionIntensity")
            _apply_tactics(row, scenario.get("tactics"))
        return selected
    rows = scenario.get("rows")
    if not isinstance(rows, list) or len(rows) != 4:
        raise PipelineError("Future forecasts require exactly four weekly rows entered in the app.")
    history_scopes = {(str(row.get("product_id")), str(row.get("customer_id"))) for row in history}
    selected: Table = []
    for source in rows:
        if not isinstance(source, dict):
            raise PipelineError("Future forecast rows must be objects.")
        product_id, customer_id = source.get("productId"), source.get("customerId")
        if not product_id or not customer_id or (str(product_id), str(customer_id)) not in history_scopes:
            raise PipelineError("Future forecasts require prior approved sales history for every product and customer scope.")
        price, stores, promotion = _number(source.get("consumerPrice")), _number(source.get("numStores")), _number(source.get("promotionIntensity"))
        if not source.get("weekNum") or price is None or stores is None or promotion is None or promotion < 0 or promotion > 1:
            raise PipelineError("Future forecasts require week, price, availability, and 0–1 promotion intensity for every row.")
        row = {"product_id": product_id, "customer_id": customer_id, "week_num": source["weekNum"], "consumer_price": price, "num_stores": stores, "promotion_intensity": promotion}
        _apply_tactics(row, source.get("tactics"))
        selected.append(row)
    return selected


def predict_scenario(model_payload: bytes, history_payload: bytes, scenario: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    try:
        model = json.loads(model_payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PipelineError("The stored model artifact is not valid analytics model JSON.") from error
    if model.get("contractVersion") != "analytics.v1" or model.get("family") not in MODEL_ORDER:
        raise PipelineError("The stored model artifact is not a reviewed analytics.v1 model.")
    history = _read_csv(history_payload)
    rows = _scenario_rows(history, scenario)
    output_rows: Table = []
    flags = ["modelled_uplift_not_causal_proof"]
    for source in rows:
        baseline = dict(source); baseline["promotion_intensity"] = 0.0
        promoted = dict(source)
        baseline_units, promoted_units = _predict(model, baseline), _predict(model, promoted)
        incremental = promoted_units - baseline_units
        output_rows.append({
            "product_id": source.get("product_id"), "customer_id": source.get("customer_id"), "week_num": source.get("week_num"),
            "baseline_units": round(baseline_units, 6), "promoted_units": round(promoted_units, 6), "incremental_units": round(incremental, 6),
            "percent_increment": round(100 * incremental / max(baseline_units, 1e-6), 6), "quality_flags": ";".join(flags),
        })
    total_baseline = sum(float(row["baseline_units"]) for row in output_rows)
    total_promoted = sum(float(row["promoted_units"]) for row in output_rows)
    # The complete immutable output remains in analytics-prediction Storage. This
    # small, rounded projection is intentionally limited for a business display.
    display_rows = [{
        "productId": str(row["product_id"]), "customerId": str(row["customer_id"]), "weekNum": str(row["week_num"]),
        "baselineUnits": row["baseline_units"], "promotedUnits": row["promoted_units"], "incrementalUnits": row["incremental_units"], "percentIncrement": row["percent_increment"],
    } for row in output_rows[:100]]
    summary = {"rowCount": len(output_rows), "totalBaselineUnits": total_baseline, "totalPromotedUnits": total_promoted, "totalIncrementalUnits": total_promoted - total_baseline, "weightedPercentIncrement": 100 * (total_promoted - total_baseline) / max(total_baseline, 1e-6), "qualityFlags": flags, "displayRows": display_rows}
    return write_csv(output_rows), summary
