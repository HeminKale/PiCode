import unittest

from app.contracts import validate_job_envelope


class ContractTests(unittest.TestCase):
    def test_rejects_unknown_contract_and_job_type(self) -> None:
        job = {"contractVersion": "analytics.v2", "id": "job_1", "projectId": "project_1", "type": "EXECUTE_PYTHON", "status": "queued", "inputArtifacts": [], "createdAt": "2026-07-21T00:00:00Z"}
        self.assertIn("Unsupported contractVersion: analytics.v2", validate_job_envelope(job))

    def test_accepts_only_fixed_code_job_envelope(self) -> None:
        job = {"contractVersion": "analytics.v1", "id": "job_1", "projectId": "project_1", "type": "PROFILE_DATASET", "status": "queued", "inputArtifacts": [], "createdAt": "2026-07-21T00:00:00Z"}
        self.assertEqual(validate_job_envelope(job), [])
