from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .config import ResourceLimits
from .contracts import validate_job_envelope
from .logging import log_event
from .jobs import process_dataset_job
from .profiling import CsvProfileError, profile_csv
from .pipeline import PipelineError
from .storage import StorageError, SupabaseStorage


def apply_process_limits(limits: ResourceLimits) -> None:
    """Apply a best-effort process cap; container limits remain the hard boundary."""
    try:
        import resource  # POSIX-only
        resource.setrlimit(resource.RLIMIT_CPU, (limits.cpu_seconds, limits.cpu_seconds))
        memory_bytes = limits.memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    except (ImportError, OSError, ValueError):
        log_event("resource_limits_not_enforced_by_host", limits=limits.as_dict())


class AnalyticsHandler(BaseHTTPRequestHandler):
    limits = ResourceLimits.from_environment()

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        log_event("http_request", detail=format % args)

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 10 * 1024 * 1024:
            raise CsvProfileError("CSV versions are limited to 10 MB.")
        return self.rfile.read(length)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/healthz":
            self._send_json(HTTPStatus.OK, {"status": "ok", "contractVersion": "analytics.v1", "resourceLimits": self.limits.as_dict()})
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            if self.path == "/v1/profile":
                profile = profile_csv(self._read_body())
                log_event("csv_profiled", dataRowCount=profile["dataRowCount"], columnCount=len(profile["columns"]))
                self._send_json(HTTPStatus.OK, profile)
                return
            if self.path == "/v1/jobs":
                payload = json.loads(self._read_body().decode("utf-8"))
                errors = validate_job_envelope(payload)
                if errors:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"errors": errors})
                    return
                log_event("job_accepted", jobId=payload["id"], jobType=payload["type"])
                if payload["type"] == "PROCESS_DATASET":
                    result = process_dataset_job(payload, SupabaseStorage())
                    log_event("job_succeeded", jobId=payload["id"], outputArtifact=result["outputArtifact"])
                    self._send_json(HTTPStatus.OK, {"id": payload["id"], "contractVersion": "analytics.v1", "eventType": "job.succeeded", **result})
                    return
                self._send_json(HTTPStatus.ACCEPTED, {"id": payload["id"], "status": "queued", "contractVersion": "analytics.v1", "eventType": "job.accepted"})
                return
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
        except (CsvProfileError, PipelineError, StorageError, UnicodeDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except json.JSONDecodeError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Body must be valid JSON."})


def run() -> None:
    limits = ResourceLimits.from_environment()
    AnalyticsHandler.limits = limits
    apply_process_limits(limits)
    host = os.getenv("ANALYTICS_WORKER_HOST", "127.0.0.1")
    port = int(os.getenv("ANALYTICS_WORKER_PORT", "8001"))
    server = ThreadingHTTPServer((host, port), AnalyticsHandler)
    log_event("worker_started", host=host, port=port, limits=limits.as_dict())
    server.serve_forever()


if __name__ == "__main__":
    run()
