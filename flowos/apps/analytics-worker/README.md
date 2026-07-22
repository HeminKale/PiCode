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
allow-listed `analytics.v1` job envelope. `PROCESS_DATASET` is a fixed declarative CSV
processor. Sprint A3 additionally implements fixed `TRAIN_MODEL` and `PREDICT` jobs:
they download only declared processed/model Storage artifacts, train reviewed ridge
linear, Poisson-style GLM, and histogram-gradient-boosting candidates with a time
holdout, and write immutable model JSON/prediction CSV artifacts. Job responses return
references, metrics, and aggregate summaries only—never raw rows or model source.

The worker excludes `BaselineUnits` and `SalesDollars` by default. `BaselineUnits` can
be explicitly enabled only when the caller declares it pre-outcome. Future forecasts
require exactly four in-app rows with product, customer, week, price, availability, and
0–1 promotion intensity; the worker rejects scopes with no approved history. Optional
tactics retain their technical intensity names and paired reported indicators so a
missing tactic is not treated as an observed zero.

Environment variables:

- `ANALYTICS_WORKER_HOST` (default `0.0.0.0`)
- `ANALYTICS_WORKER_PORT` (default `8001`)
- `PORT` (Railway-provided port; takes precedence over `ANALYTICS_WORKER_PORT`)
- `ANALYTICS_WORKER_SHARED_SECRET` (required when called by the API in deployment)
- `ANALYTICS_WORKER_CPU_SECONDS` (default `60`)
- `ANALYTICS_WORKER_MEMORY_MB` (default `512`)
- `ANALYTICS_WORKER_MAX_CONCURRENT_JOBS` (default `1`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required for `PROCESS_DATASET` only)

Container orchestration must enforce the same CPU/memory limits. Python applies
process limits where the host supports `resource`; Windows reports configuration only.

The service-role key must be configured only in backend environments. In Railway,
configure the worker without a public domain and call it from the API over Railway
private networking. Set the same `ANALYTICS_WORKER_SHARED_SECRET` on both the API
service and the worker service. Set `ANALYTICS_WORKER_URL` only on the API service;
it must point to the worker's private Railway address, not `127.0.0.1`.
