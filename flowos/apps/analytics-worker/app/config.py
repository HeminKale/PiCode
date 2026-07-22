from __future__ import annotations

from dataclasses import asdict, dataclass
import os


@dataclass(frozen=True)
class ResourceLimits:
    cpu_seconds: int
    memory_mb: int
    max_concurrent_jobs: int

    @classmethod
    def from_environment(cls) -> "ResourceLimits":
        return cls(
            cpu_seconds=int(os.getenv("ANALYTICS_WORKER_CPU_SECONDS", "60")),
            memory_mb=int(os.getenv("ANALYTICS_WORKER_MEMORY_MB", "512")),
            max_concurrent_jobs=int(os.getenv("ANALYTICS_WORKER_MAX_CONCURRENT_JOBS", "1")),
        )

    def as_dict(self) -> dict[str, int]:
        return asdict(self)
