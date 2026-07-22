import json
from threading import Thread
import unittest
from urllib.request import urlopen
from http.server import ThreadingHTTPServer

from app.main import AnalyticsHandler


class WorkerHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), AnalyticsHandler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def test_health_endpoint_reports_contract_and_limits(self) -> None:
        with urlopen(f"http://127.0.0.1:{self.server.server_port}/healthz") as response:
            payload = json.loads(response.read())
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["contractVersion"], "analytics.v1")
        self.assertIn("memory_mb", payload["resourceLimits"])
