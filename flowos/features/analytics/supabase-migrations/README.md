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

The project owner reports that `001` and `003` have already been manually applied.
`004` is awaiting manual review and application before an A2 pipeline run can persist a
processed DatasetVersion.
