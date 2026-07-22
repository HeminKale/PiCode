# Analytics Supabase migrations

These migrations are intentionally separate from Prisma migrations. The project owner
runs them manually against Supabase after reviewing the SQL.

## Naming and order

Use zero-padded, immutable names:

```text
001_analytics_foundation.sql
002_analytics_storage_policies.sql
003_analytics_pipeline_runs.sql
004_analytics_processed_dataset_versions.sql
005_analytics_models_and_predictions.sql
006_analytics_audit_and_retention.sql
007_analytics_rbac_operations_and_drift.sql
```

Never alter an applied file. Add the next sequence number for any correction. Every SQL
file must be idempotent where practical, state its required Supabase extensions, and
include a rollback/manual-recovery note in a leading comment.

Sprint A1 provided `001_analytics_foundation.sql` for Analytics metadata only. Sprint A2
provides `003_analytics_pipeline_runs.sql` for immutable pipeline versions, runs, node
lineage, and quality reports, plus `004_analytics_processed_dataset_versions.sql` for
the processed-dataset lifecycle required by A2 execution. Neither script touches the
existing Prisma manual-migration workaround. `002` is intentionally not created yet:
this branch uses API-side service-role access and has not implemented the
authenticated-user Storage/RLS policy requirements that must be reviewed together.

The project owner reports that `001`, `003`, `004`, and `005` have already been
manually applied. Do not edit or rerun them. The four private Storage buckets
(`analytics-raw`, `analytics-processed`, `analytics-model`, and
`analytics-prediction`) already exist.

Sprint A4 adds `006_analytics_audit_and_retention.sql`. It is awaiting the project
owner's manual review/application. It adds project-scoped audit events, retention
metadata, and cleanup schedule metadata only; it does not delete objects, create a
worker schedule, change Storage policies, or alter the Prisma workaround.

Sprint A5 adds `007_analytics_rbac_operations_and_drift.sql`, which must be reviewed
and applied only after `006`. It adds active workspace/project membership records,
actor-linked audit events, private-bucket/RLS policies, job retry/dead-letter metadata,
and metadata-only drift baselines. It does not delete Storage objects or deploy a
cleanup, queue, or remote worker. Backfill at least one active `owner`/`admin` workspace
membership for each existing workspace before sending authenticated traffic.
