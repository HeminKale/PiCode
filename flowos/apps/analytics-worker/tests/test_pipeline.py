import unittest

from app.pipeline import PipelineError, run_pipeline


class PipelineTests(unittest.TestCase):
    def test_joins_sales_to_calendar_and_derives_tactic_reporting(self) -> None:
        sources = {
            "sales": b"ProductId,CustomerId,WeekNum,IsPromotion,Tactic1,SalesUnits\nP1,C1,2026-01,0,,12\nP2,C1,2026-01,1,0,8\n",
            "calendar": b"Year-WeekNumber,WeekStart,WeekEnd\n2026-01,2026-01-05,2026-01-11\n",
        }
        pipeline = {"contractVersion": "analytics.v1", "nodes": [
            {"id": "sales", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "sales"}},
            {"id": "sales_rename", "type": "RENAME_COLUMNS", "inputIds": ["sales"], "config": {"mappings": {"ProductId": "product_id", "CustomerId": "customer_id", "WeekNum": "week_num", "IsPromotion": "promotion_intensity", "Tactic1": "tactic_01_intensity", "SalesUnits": "sales_units"}}},
            {"id": "sales_cast", "type": "CAST_COLUMNS", "inputIds": ["sales_rename"], "config": {"columns": {"promotion_intensity": "number", "tactic_01_intensity": "number", "sales_units": "number"}}},
            {"id": "calendar", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "calendar"}},
            {"id": "calendar_rename", "type": "RENAME_COLUMNS", "inputIds": ["calendar"], "config": {"mappings": {"Year-WeekNumber": "week_num"}}},
            {"id": "join", "type": "JOIN", "inputIds": ["sales_cast", "calendar_rename"], "config": {"leftKeys": ["week_num"], "rightKeys": ["week_num"], "joinType": "left", "duplicateKeyPolicy": "reject", "reportMissingMatch": True}},
            {"id": "tactic_reported", "type": "DERIVE_COLUMN", "inputIds": ["join"], "config": {"operation": "reported_indicator", "sourceColumn": "tactic_01_intensity", "targetColumn": "tactic_01_reported"}},
            {"id": "output", "type": "OUTPUT_DATASET", "inputIds": ["tactic_reported"], "config": {}},
        ]}
        result = run_pipeline(sources, pipeline)
        self.assertEqual(result["qualityReport"]["outputRowCount"], 2)
        self.assertEqual(result["rows"][0]["tactic_01_reported"], 0)
        self.assertEqual(result["rows"][1]["tactic_01_intensity"], 0.0)
        self.assertEqual(result["rows"][1]["tactic_01_reported"], 1)

    def test_rejects_duplicate_grain_without_explicit_aggregation(self) -> None:
        pipeline = {"contractVersion": "analytics.v1", "nodes": [
            {"id": "input", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "sales"}},
            {"id": "dedupe", "type": "DEDUPLICATE", "inputIds": ["input"], "config": {"keys": ["ProductId", "CustomerId", "WeekNum"], "policy": "reject"}},
        ]}
        with self.assertRaisesRegex(PipelineError, "duplicate keys"):
            run_pipeline({"sales": b"ProductId,CustomerId,WeekNum\nP1,C1,2026-01\nP1,C1,2026-01\n"}, pipeline)

    def test_reports_invalid_promotion_values(self) -> None:
        pipeline = {"contractVersion": "analytics.v1", "nodes": [
            {"id": "input", "type": "CSV_INPUT", "inputIds": [], "config": {"sourceId": "sales"}},
            {"id": "rename", "type": "RENAME_COLUMNS", "inputIds": ["input"], "config": {"mappings": {"IsPromotion": "promotion_intensity"}}},
        ]}
        result = run_pipeline({"sales": b"IsPromotion\n2\n"}, pipeline)
        self.assertEqual(result["qualityReport"]["findings"][0]["code"], "invalid_promotion_intensity")
