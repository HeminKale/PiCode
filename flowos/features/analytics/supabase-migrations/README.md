# Analytics Supabase migrations

These migrations are intentionally separate from Prisma migrations. The project owner
runs them manually against Supabase after reviewing the SQL.

## Naming and order

Use zero-padded, immutable names:

```text
001_analytics_foundation.sql
002 (intentionally skipped; no migration file)
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
existing Prisma manual-migration workaround. `002` was deliberately skipped and no file
exists for it. Its originally planned Storage-policy work was superseded by `007`, which
is already applied. Never create `002` retrospectively; make any database correction in
the next migration number, `008`.

The project owner reports that `001`, `003`, `004`, `005`, `006`, and `007` have
already been manually applied. Do not edit or rerun them. The four private Storage buckets
(`analytics-raw`, `analytics-processed`, `analytics-model`, and
`analytics-prediction`) already exist.

Sprint A4 (`006`) adds project-scoped audit events, retention metadata, and cleanup
schedule metadata only; it does not delete objects, create a worker schedule, change
Storage policies, or alter the Prisma workaround. Sprint A5 (`007`) adds active
workspace/project membership records, actor-linked audit events, private-bucket/RLS
policies, job retry/dead-letter metadata, and metadata-only drift baselines. It does not
delete Storage objects or deploy a cleanup, queue, or remote worker.

## Auth and workspace bootstrap

Analytics authorization requires both a signed-in Supabase user and an active row in
`public.analytics_workspace_members`. Do not insert into `auth.users` with SQL. Create
or invite users through Supabase Dashboard Authentication > Users, or from trusted
server code using Supabase Auth's Admin API. Never expose a Supabase service-role key in
the web app.

For an existing Analytics installation, discover the workspace IDs with:

```sql
select distinct workspace_id
from public.analytics_projects
order by workspace_id;
```

If there are no projects yet, establish a stable workspace ID in the future FlowOS
workspace provider (for example, `flowos-main`). That exact ID must be used for both
the selected FlowOS workspace and its Analytics membership row.

After the user has confirmed their invite, locate the Auth user ID with:

```sql
select id, email, email_confirmed_at, created_at
from auth.users
order by created_at desc;
```

Backfill or update at least one privileged membership for every workspace:

```sql
insert into public.analytics_workspace_members (
  workspace_id,
  actor_id,
  role,
  status
)
values (
  'flowos-main',
  'REPLACE-WITH-SUPABASE-AUTH-USER-UUID',
  'owner',
  'active'
)
on conflict (workspace_id, actor_id) do update
set role = excluded.role,
    status = 'active',
    updated_at = now();
```

Verify no Analytics workspace is missing an active `owner` or `admin` before allowing
authenticated traffic:

```sql
select p.workspace_id
from public.analytics_projects p
where not exists (
  select 1
  from public.analytics_workspace_members m
  where m.workspace_id = p.workspace_id
    and m.status = 'active'
    and m.role in ('owner', 'admin')
);
```

## FlowOS browser authentication and workspace selection

Sprint A5.5 adds a browser-safe Supabase client, sign-in UI, session refresh/sign-out,
and workspace selector. Its top-level client-side provider calls
`setAnalyticsAuthContext({ workspaceId, accessToken })` whenever the selected workspace
or Supabase access token changes, and calls `setAnalyticsAuthContext(undefined)` on
sign-out, session expiry, or workspace deselection. The API independently verifies the
bearer token and active membership; the workspace ID is only a selector.

Configure the web app with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` is
also accepted). `apps/web/.env.example` contains the safe local-development shape.
These are public browser credentials; never set `SUPABASE_SERVICE_ROLE_KEY` or any
server credential in a `NEXT_PUBLIC_*` variable.

### Existing-user membership bootstrap

Creating a user in Supabase Auth does **not** make that user an Analytics manager or
admin. The role belongs to an active workspace-membership record. First discover the
actual workspace IDs and the user's existing memberships:

```sql
select distinct workspace_id
from public.analytics_projects
order by workspace_id;

select workspace_id, role, status
from public.analytics_workspace_members
where actor_id = 'ee47c876-e4a3-4975-84a6-a3baf2e6de89'
order by workspace_id;
```

After choosing the intended workspace, assign the least-privileged role required. Use
`owner` or `admin` only for the person who administers Analytics access; use `manager`
for a person who needs to manage pipelines and approve models but should not administer
the workspace:

```sql
insert into public.analytics_workspace_members (
  workspace_id,
  actor_id,
  role,
  status
)
values (
  'REPLACE-WITH-ACTUAL-WORKSPACE-ID',
  'ee47c876-e4a3-4975-84a6-a3baf2e6de89',
  'manager',
  'active'
)
on conflict (workspace_id, actor_id) do update
set role = excluded.role,
    status = 'active',
    updated_at = now();
```

Run this only after replacing the workspace ID and confirming the intended role. To
make the user an administrator instead, replace `manager` with `admin` after verifying
they should manage membership and retention policies.

Deploy the Next.js app on Vercel with `NEXT_PUBLIC_API_URL`, the public Supabase URL,
and the public Supabase publishable key. Deploy the Nest API and Analytics worker on
Railway with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only variables.
Set the API's CORS allowlist to the Vercel production domain and any intentional preview
domains before enabling browser authentication. Do not set a service-role key in Vercel
or in a `NEXT_PUBLIC_*` variable.
