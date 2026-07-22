# FlowOS Analytics worker

This standalone service owns fixed-code analytics work. It does not load user code,
LLM-generated code, or FlowOS `flowJson`. Its public boundary is the versioned
`@flowos/analytics-contracts` JSON contract.

## Local run

```bash
python -m app.main
```

`GET /healthz` reports the configured resource limits. `POST /v1/profile` accepts a
CSV body and returns only a schema/profile summary. `POST /v1/jobs` accepts an
allow-listed `analytics.v1` job envelope. Sprint A2 implements `PROCESS_DATASET` as a
fixed declarative CSV processor: it downloads listed source artifacts from private
Supabase Storage, writes one immutable processed CSV, and returns only its reference,
profile summary, and quality report. Training and prediction remain deferred to A3.

Environment variables:

- `ANALYTICS_WORKER_HOST` (default `127.0.0.1`)
- `ANALYTICS_WORKER_PORT` (default `8001`)
- `ANALYTICS_WORKER_CPU_SECONDS` (default `60`)
- `ANALYTICS_WORKER_MEMORY_MB` (default `512`)
- `ANALYTICS_WORKER_MAX_CONCURRENT_JOBS` (default `1`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required for `PROCESS_DATASET` only)

Container orchestration must enforce the same CPU/memory limits. Python applies
process limits where the host supports `resource`; Windows reports configuration only.

The service-role key must be configured only in the worker environment. In deployment,
`ANALYTICS_WORKER_URL` from the API must be a reachable HTTPS worker address; Vercel
cannot call a worker at `127.0.0.1`.
