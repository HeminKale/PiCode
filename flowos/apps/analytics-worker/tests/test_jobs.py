import unittest

from app.jobs import process_dataset_job


class MemoryStorage:
    def __init__(self) -> None:
        self.objects = {("analytics-raw", "sales.csv"): b"ProductId,CustomerId,WeekNum,SalesUnits\nP1,C1,2026-01,10\n"}

    def download(self, artifact: dict) -> bytes:
        return self.objects[(artifact["bucket"], artifact["path"])]

    def upload_immutable(self, artifact: dict, payload: bytes) -> dict:
        self.objects[(artifact["bucket"], artifact["path"])] = payload
        return {**artifact, "sha256": "a" * 64}


class ProcessDatasetJobTests(unittest.TestCase):
    def test_processes_storage_inputs_and_returns_summary_only(self) -> None:
        storage = MemoryStorage()
        result = process_dataset_job({
            "pipeline": {"contractVersion": "analytics.v1", "nodes": [
                {"id": "sales", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "sales"}},
                {"id": "rename", "type": "RENAME_COLUMNS", "inputIds": ["sales"], "config": {"mappings": {"ProductId": "product_id", "CustomerId": "customer_id", "WeekNum": "week_num", "SalesUnits": "sales_units"}}},
                {"id": "output", "type": "OUTPUT_DATASET", "inputIds": ["rename"], "config": {}},
            ]},
            "sources": [{"sourceId": "sales", "artifact": {"bucket": "analytics-raw", "path": "sales.csv", "artifactKind": "raw"}}],
            "outputArtifact": {"bucket": "analytics-processed", "path": "processed.csv", "artifactKind": "processed"},
        }, storage)
        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(result["qualityReport"]["outputRowCount"], 1)
        self.assertNotIn("rows", result)
        self.assertIn(b"product_id", storage.objects[("analytics-processed", "processed.csv")])
