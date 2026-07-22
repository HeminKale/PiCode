from __future__ import annotations

from typing import Any, Protocol

from .pipeline import PipelineError, run_pipeline, write_csv
from .profiling import profile_csv


class ArtifactStorage(Protocol):
    def download(self, artifact: dict[str, Any]) -> bytes: ...
    def upload_immutable(self, artifact: dict[str, Any], payload: bytes) -> dict[str, Any]: ...


def process_dataset_job(payload: dict[str, Any], storage: ArtifactStorage) -> dict[str, Any]:
    """Execute only the declarative analytics.v1 processor against Storage artifacts."""
    pipeline = payload.get("pipeline")
    sources = payload.get("sources")
    output = payload.get("outputArtifact")
    if not isinstance(pipeline, dict) or not isinstance(sources, list) or not isinstance(output, dict):
        raise PipelineError("PROCESS_DATASET requires pipeline, sources, and outputArtifact.")
    source_bytes: dict[str, bytes] = {}
    for source in sources:
        if not isinstance(source, dict) or not isinstance(source.get("sourceId"), str) or not isinstance(source.get("artifact"), dict):
            raise PipelineError("Each processing source needs a sourceId and Storage artifact.")
        source_id = source["sourceId"]
        if source_id in source_bytes:
            raise PipelineError("Processing source IDs must be unique.")
        source_bytes[source_id] = storage.download(source["artifact"])
    result = run_pipeline(source_bytes, pipeline)
    csv_output = write_csv(result["rows"])
    artifact = storage.upload_immutable(output, csv_output)
    return {"status": "succeeded", "outputArtifact": artifact, "outputByteSize": len(csv_output), "outputProfile": profile_csv(csv_output), "qualityReport": result["qualityReport"]}
