from __future__ import annotations

import json
import logging
from typing import Any


def configure_structured_logging() -> logging.Logger:
    logger = logging.getLogger("flowos.analytics_worker")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


LOGGER = configure_structured_logging()


def log_event(event: str, **fields: Any) -> None:
    LOGGER.info(json.dumps({"service": "analytics-worker", "event": event, **fields}, sort_keys=True))
