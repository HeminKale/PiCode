from __future__ import annotations

from typing import Any

CONTRACT_VERSION = "analytics.v1"
ALLOWED_JOB_TYPES = {"PROFILE_DATASET", "PROCESS_DATASET", "TRAIN_MODEL", "PREDICT"}


def validate_job_envelope(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["Job payload must be a JSON object."]
    required = ("contractVersion", "id", "projectId", "type", "status", "inputArtifacts", "createdAt")
    missing = [key for key in required if key not in payload or payload[key] is None or payload[key] == ""]
    if missing:
        return [f"Missing required field: {key}" for key in missing]
    if payload["contractVersion"] != CONTRACT_VERSION:
        return [f"Unsupported contractVersion: {payload['contractVersion']}"]
    if payload["type"] not in ALLOWED_JOB_TYPES:
        return [f"Unsupported fixed-code job type: {payload['type']}"]
    if not isinstance(payload["inputArtifacts"], list):
        return ["inputArtifacts must be an array."]
    return []
