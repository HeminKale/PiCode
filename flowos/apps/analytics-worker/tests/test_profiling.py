import unittest

from app.profiling import CsvProfileError, MAX_CSV_DATA_ROWS, profile_csv


class CsvProfilingTests(unittest.TestCase):
    def test_profiles_csv_and_preserves_observed_zero(self) -> None:
        profile = profile_csv(b"ProductId,IsPromotion,Tactic1\nA,0,\nB,1,0\n")
        self.assertEqual(profile["dataRowCount"], 2)
        self.assertEqual(profile["columns"][1]["inferredType"], "number")
        self.assertEqual(profile["columns"][2]["nullCount"], 1)
        self.assertNotIn("sampleValues", profile["columns"][2])

    def test_rejects_rows_over_operational_limit(self) -> None:
        payload = "x\n" + "1\n" * (MAX_CSV_DATA_ROWS + 1)
        with self.assertRaisesRegex(CsvProfileError, "15,000"):
            profile_csv(payload.encode())

    def test_rejects_malformed_rows(self) -> None:
        with self.assertRaisesRegex(CsvProfileError, "different number"):
            profile_csv(b"a,b\n1\n")
