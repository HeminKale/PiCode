"""Fixed-code A4 integration coverage for the synthetic shop lifecycle.

This exercises the same private-artifact handoff used by the API: profile/upload
boundary, pipeline, model, and a bounded business prediction projection.
"""
import unittest

from app.jobs import predict_job, process_dataset_job, train_model_job
from app.profiling import profile_csv


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    def download(self, artifact: dict) -> bytes:
        return self.objects[(artifact["bucket"], artifact["path"])]

    def upload_immutable(self, artifact: dict, payload: bytes) -> dict:
        self.objects[(artifact["bucket"], artifact["path"])] = payload
        return {**artifact, "sha256": "e" * 64}


def synthetic_shop_csv() -> tuple[bytes, bytes]:
    sales = ["ProductId,CustomerId,WeekNum,NumStores,ConsumerPrice,IsPromotion,Tactic1,SalesUnits"]
    calendar = ["Year-WeekNumber,WeekStart,WeekEnd"]
    for week in range(1, 9):
        week_num = f"2026-{week:02d}"
        calendar.append(f"{week_num},2026-01-01,2026-01-07")
        for product in range(1, 101):
            for customer in range(1, 3):
                promotion = 1 if (week + product + customer) % 5 == 0 else 0
                price, stores = 8 + product % 9, 2 + customer
                # The known 9-unit uplift is intentionally recoverable by ridge.
                units = 18 + product % 7 + customer * 2 + week + stores - price * 0.2 + promotion * 9
                sales.append(f"P{product:03d},C{customer:03d},{week_num},{stores},{price},{promotion},{promotion},{units:.3f}")
    return ("\n".join(sales) + "\n").encode(), ("\n".join(calendar) + "\n").encode()


class SyntheticShopEndToEndTests(unittest.TestCase):
    def test_csv_pipeline_model_and_business_uplift_view(self) -> None:
        storage = MemoryStorage()
        sales, calendar = synthetic_shop_csv()
        self.assertEqual(profile_csv(sales)["dataRowCount"], 1_600)
        storage.objects[("analytics-raw", "sales.csv")] = sales
        storage.objects[("analytics-raw", "calendar.csv")] = calendar
        pipeline = {
            "contractVersion": "analytics.v1",
            "nodes": [
                {"id": "sales", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "sales"}},
                {"id": "rename", "type": "RENAME_COLUMNS", "inputIds": ["sales"], "config": {"mappings": {"ProductId": "product_id", "CustomerId": "customer_id", "WeekNum": "week_num", "NumStores": "num_stores", "ConsumerPrice": "consumer_price", "IsPromotion": "promotion_intensity", "Tactic1": "tactic_01_intensity", "SalesUnits": "sales_units"}}},
                {"id": "cast", "type": "CAST_COLUMNS", "inputIds": ["rename"], "config": {"columns": {"num_stores": "number", "consumer_price": "number", "promotion_intensity": "number", "sales_units": "number"}}},
                {"id": "calendar", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "calendar"}},
                {"id": "calendar_rename", "type": "RENAME_COLUMNS", "inputIds": ["calendar"], "config": {"mappings": {"Year-WeekNumber": "week_num", "WeekStart": "week_start", "WeekEnd": "week_end"}}},
                {"id": "join", "type": "JOIN", "inputIds": ["cast", "calendar_rename"], "config": {"leftKeys": ["week_num"], "rightKeys": ["week_num"], "joinType": "left", "duplicateKeyPolicy": "reject", "reportMissingMatch": True}},
                {"id": "deduplicate", "type": "DEDUPLICATE", "inputIds": ["join"], "config": {"keys": ["product_id", "customer_id", "week_num"], "policy": "reject"}},
                {"id": "output", "type": "OUTPUT_DATASET", "inputIds": ["deduplicate"], "config": {}},
            ],
        }
        processed = process_dataset_job({"pipeline": pipeline, "sources": [{"sourceId": "sales", "artifact": {"bucket": "analytics-raw", "path": "sales.csv"}}, {"sourceId": "calendar", "artifact": {"bucket": "analytics-raw", "path": "calendar.csv"}}], "outputArtifact": {"bucket": "analytics-processed", "path": "features.csv"}}, storage)
        self.assertEqual(processed["qualityReport"]["outputRowCount"], 1_600)
        trained = train_model_job({"trainingArtifact": processed["outputArtifact"], "modelArtifact": {"bucket": "analytics-model", "path": "model.json"}, "trainingRequest": {"candidateAlgorithms": ["ridge_linear"], "validationWeeks": 2, "thresholds": {"maxWape": 1000}}}, storage)
        self.assertTrue(trained["isApproved"])
        predicted = predict_job({"modelArtifact": trained["modelArtifact"], "historyArtifact": processed["outputArtifact"], "predictionArtifact": {"bucket": "analytics-prediction", "path": "uplift.csv"}, "scenario": {"mode": "historical_what_if", "customerId": "C001", "productIds": ["P001", "P002", "P003", "P004"], "weekNums": ["2026-07", "2026-08"], "promotionIntensity": 1}}, storage)
        self.assertEqual(predicted["summary"]["rowCount"], 8)
        self.assertGreater(predicted["summary"]["totalPromotedUnits"], predicted["summary"]["totalBaselineUnits"])
        self.assertEqual(len(predicted["summary"]["displayRows"]), 8)
        self.assertNotIn("rows", predicted)
        self.assertIn(("analytics-prediction", "uplift.csv"), storage.objects)

