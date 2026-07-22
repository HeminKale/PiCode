import json
import unittest

from app.models import predict_scenario, train_model


def training_csv() -> bytes:
    rows = ["product_id,customer_id,week_num,consumer_price,num_stores,promotion_intensity,tactic_01_intensity,tactic_01_reported,sales_units"]
    for week in range(1, 9):
        for promotion in (0, 1):
            units = 10 + week + promotion * 8
            rows.append(f"P1,C1,2026-{week:02d},10,3,{promotion},{promotion},{1 if promotion else 0},{units}")
    return ("\n".join(rows) + "\n").encode()


class ModelTests(unittest.TestCase):
    def test_trains_fixed_candidates_with_time_holdout_and_leakage_guard(self) -> None:
        result = train_model(training_csv(), {
            "candidateAlgorithms": ["ridge_linear", "poisson_glm", "histogram_gradient_boosting"],
            "validationWeeks": 2,
            "thresholds": {"maxWape": 1000},
        })
        self.assertTrue(result["isApproved"])
        self.assertEqual(result["model"]["family"], "ridge_linear")
        self.assertNotIn("baseline_units", result["featureSet"]["features"])
        self.assertEqual(len(result["evaluations"]), 3)
        self.assertIn("wape", result["metrics"])

    def test_future_prediction_requires_history_and_writes_paired_outputs(self) -> None:
        trained = train_model(training_csv(), {"candidateAlgorithms": ["ridge_linear"], "validationWeeks": 2, "thresholds": {"maxWape": 1000}})
        output, summary = predict_scenario(
            json.dumps(trained["model"]).encode(), training_csv(),
            {"mode": "future_forecast", "rows": [
                {"productId": "P1", "customerId": "C1", "weekNum": f"2026-{week:02d}", "consumerPrice": 10, "numStores": 3, "promotionIntensity": 1}
                for week in range(9, 13)
            ]},
        )
        self.assertEqual(summary["rowCount"], 4)
        self.assertGreater(summary["totalPromotedUnits"], summary["totalBaselineUnits"])
        self.assertIn(b"incremental_units", output)
        self.assertNotIn(b"sales_units", output)

    def test_future_prediction_rejects_scope_without_history(self) -> None:
        trained = train_model(training_csv(), {"candidateAlgorithms": ["ridge_linear"], "validationWeeks": 2})
        with self.assertRaisesRegex(ValueError, "prior approved sales history"):
            predict_scenario(json.dumps(trained["model"]).encode(), training_csv(), {"mode": "future_forecast", "rows": [
                {"productId": "P2", "customerId": "C1", "weekNum": f"2026-{week:02d}", "consumerPrice": 10, "numStores": 3, "promotionIntensity": 0.5}
                for week in range(9, 13)
            ]})
