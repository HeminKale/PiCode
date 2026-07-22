import json
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

from app.main import AnalyticsHandler


class WorkerHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        AnalyticsHandler.shared_secret = ""
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), AnalyticsHandler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        AnalyticsHandler.shared_secret = ""

    def test_health_endpoint_reports_contract_and_limits(self) -> None:
        with urlopen(f"http://127.0.0.1:{self.server.server_port}/healthz") as response:
            payload = json.loads(response.read())
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["contractVersion"], "analytics.v1")
        self.assertIn("memory_mb", payload["resourceLimits"])

    def test_post_requires_matching_shared_secret_when_configured(self) -> None:
        AnalyticsHandler.shared_secret = "test-secret"
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}/v1/profile",
            data=b"a,b\n1,2\n",
            method="POST",
            headers={"Content-Type": "text/csv"},
        )

        with self.assertRaises(HTTPError) as error:
            urlopen(request)

        self.assertEqual(error.exception.code, 401)

    def test_post_accepts_matching_shared_secret(self) -> None:
        AnalyticsHandler.shared_secret = "test-secret"
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}/v1/profile",
            data=b"a,b\n1,2\n",
            method="POST",
            headers={"Content-Type": "text/csv", "x-analytics-worker-secret": "test-secret"},
        )

        with urlopen(request) as response:
            payload = json.loads(response.read())

        self.assertEqual(payload["dataRowCount"], 1)
