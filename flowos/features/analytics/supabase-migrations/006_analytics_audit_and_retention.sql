-- Analytics Sprint A4 audit/retention metadata. Review and apply manually after 005.
-- Required extension: pgcrypto (enabled by 001). This script is idempotent where
-- practical and does not modify Prisma migrations, FlowOS tables, or Storage/RLS policy.
--
-- Manual recovery/rollback: drop analytics_cleanup_schedules, analytics_retention_policies,
-- and analytics_audit_events only after retaining any required compliance evidence. This
-- migration schedules metadata only; it never deletes Storage objects by itself.

create table if not exists public.analytics_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 120),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text,
  actor_type text not null default 'service' check (actor_type in ('service', 'system', 'user')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_audit_events_project_created_idx
  on public.analytics_audit_events (project_id, created_at desc);
create index if not exists analytics_audit_events_workspace_created_idx
  on public.analytics_audit_events (workspace_id, created_at desc);

create table if not exists public.analytics_retention_policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  artifact_kind text not null check (artifact_kind in ('raw', 'processed', 'model', 'prediction')),
  retention_days integer not null check (retention_days between 1 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, artifact_kind)
);

create table if not exists public.analytics_cleanup_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.analytics_projects(id) on delete cascade,
  schedule_cron text not null default '0 3 * * *',
  is_enabled boolean not null default true,
  last_scheduled_at timestamptz,
  next_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.analytics_retention_policies (project_id, artifact_kind, retention_days)
select project.id, artifact.kind, artifact.days
from public.analytics_projects as project
cross join (values ('raw', 365), ('processed', 365), ('model', 730), ('prediction', 365)) as artifact(kind, days)
on conflict (project_id, artifact_kind) do nothing;

insert into public.analytics_cleanup_schedules (project_id)
select id from public.analytics_projects
on conflict (project_id) do nothing;

comment on table public.analytics_audit_events is
  'A4 operation audit metadata only. details must never contain raw CSV rows, processed rows, model payloads, or prediction output rows.';
comment on table public.analytics_retention_policies is
  'Per-project Storage artifact retention metadata. A future trusted cleanup worker interprets these policies.';
comment on table public.analytics_cleanup_schedules is
  'Cleanup scheduling metadata only; no scheduled deletion mechanism is deployed by A4.';
