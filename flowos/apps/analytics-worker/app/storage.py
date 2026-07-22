from __future__ import annotations

import hashlib
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class StorageError(RuntimeError):
    pass


class SupabaseStorage:
    """Minimal Storage client used only by fixed worker job handlers."""

    def __init__(self, url: str | None = None, service_role_key: str | None = None) -> None:
        self.url = (url or os.getenv("SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

    def _headers(self, content_type: str | None = None) -> dict[str, str]:
        if not self.url or not self.service_role_key:
            raise StorageError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for processing jobs.")
        headers = {"apikey": self.service_role_key, "Authorization": f"Bearer {self.service_role_key}"}
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _object_url(self, bucket: str, path: str) -> str:
        encoded_path = "/".join(quote(segment, safe="") for segment in path.split("/"))
        return f"{self.url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}"

    def download(self, artifact: dict[str, Any]) -> bytes:
        request = Request(self._object_url(str(artifact["bucket"]), str(artifact["path"])), headers=self._headers(), method="GET")
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except (HTTPError, URLError) as error:
            raise StorageError(f"Could not download analytics input: {error}") from error

    def upload_immutable(self, artifact: dict[str, Any], payload: bytes) -> dict[str, Any]:
        headers = self._headers("text/csv")
        headers["x-upsert"] = "false"
        request = Request(self._object_url(str(artifact["bucket"]), str(artifact["path"])), data=payload, headers=headers, method="POST")
        try:
            with urlopen(request, timeout=30):
                pass
        except (HTTPError, URLError) as error:
            raise StorageError(f"Could not upload processed dataset: {error}") from error
        return {**artifact, "sha256": hashlib.sha256(payload).hexdigest()}
