from __future__ import annotations

import json
from typing import Any, Protocol

from .pipeline import PipelineError, run_pipeline, write_csv
from .profiling import profile_csv
from .models import predict_scenario, train_model


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


def train_model_job(payload: dict[str, Any], storage: ArtifactStorage) -> dict[str, Any]:
    """Train reviewed fixed algorithms from a processed Storage artifact only."""
    training_artifact = payload.get("trainingArtifact")
    output = payload.get("modelArtifact")
    request = payload.get("trainingRequest")
    if not isinstance(training_artifact, dict) or not isinstance(output, dict) or not isinstance(request, dict):
        raise PipelineError("TRAIN_MODEL requires trainingArtifact, modelArtifact, and trainingRequest.")
    result = train_model(storage.download(training_artifact), request)
    artifact = storage.upload_immutable(output, json.dumps(result["model"], sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return {"status": "succeeded", "modelArtifact": artifact, **{key: value for key, value in result.items() if key != "model"}}


def predict_job(payload: dict[str, Any], storage: ArtifactStorage) -> dict[str, Any]:
    """Create paired baseline/promotion output in Storage; do not return prediction rows."""
    model_artifact = payload.get("modelArtifact")
    history_artifact = payload.get("historyArtifact")
    output = payload.get("predictionArtifact")
    scenario = payload.get("scenario")
    if not isinstance(model_artifact, dict) or not isinstance(history_artifact, dict) or not isinstance(output, dict) or not isinstance(scenario, dict):
        raise PipelineError("PREDICT requires modelArtifact, historyArtifact, predictionArtifact, and scenario.")
    csv_output, summary = predict_scenario(storage.download(model_artifact), storage.download(history_artifact), scenario)
    artifact = storage.upload_immutable(output, csv_output)
    return {"status": "succeeded", "predictionArtifact": artifact, "outputByteSize": len(csv_output), "summary": summary}
