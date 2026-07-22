-- Analytics Sprint A5. Review and apply manually only after 006.
-- Required extension: pgcrypto (already enabled by 001). This migration adds identity
-- metadata, RLS and private-storage policies; it does not alter Prisma migrations,
-- deploy a worker, delete Storage objects, or make any bucket public.
--
-- Manual recovery: disable/drop the policies and A5 tables only after confirming that
-- no audit or access-control evidence is required. Do not remove Storage objects here.

create table if not exists public.analytics_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','analyst','business_user','viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, actor_id)
);
create index if not exists analytics_workspace_members_actor_workspace_idx on public.analytics_workspace_members (actor_id, workspace_id) where status = 'active';

create table if not exists public.analytics_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','analyst','business_user','viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, actor_id)
);
create index if not exists analytics_project_members_actor_project_idx on public.analytics_project_members (actor_id, project_id) where status = 'active';

alter table public.analytics_audit_events add column if not exists actor_id uuid references auth.users(id) on delete set null;
create index if not exists analytics_audit_events_actor_created_idx on public.analytics_audit_events (actor_id, created_at desc) where actor_id is not null;
alter table public.analytics_model_versions add column if not exists approved_at timestamptz;

alter table public.analytics_jobs add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0);
alter table public.analytics_jobs add column if not exists max_attempts integer not null default 2 check (max_attempts between 1 and 5);
alter table public.analytics_jobs add column if not exists last_attempt_at timestamptz;
alter table public.analytics_jobs add column if not exists dead_lettered_at timestamptz;
alter table public.analytics_jobs drop constraint if exists analytics_jobs_status_check;
alter table public.analytics_jobs add constraint analytics_jobs_status_check check (status in ('queued','running','retrying','succeeded','failed','dead_lettered','cancelled'));
create index if not exists analytics_jobs_project_status_created_idx on public.analytics_jobs (project_id, status, created_at desc);

create table if not exists public.analytics_drift_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  model_version_id uuid not null references public.analytics_model_versions(id) on delete cascade,
  dataset_version_id uuid not null references public.analytics_dataset_versions(id) on delete cascade,
  status text not null check (status in ('baseline_captured','within_threshold','warning','failed')),
  baseline_fingerprint text not null check (char_length(baseline_fingerprint) = 64),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_drift_reports_project_created_idx on public.analytics_drift_reports (project_id, created_at desc);

-- Security-definer helpers allow policies to check membership without exposing member rows.
create or replace function public.analytics_workspace_role(p_workspace_id text)
returns text language sql stable security definer set search_path = public as $$
  select role from public.analytics_workspace_members
  where workspace_id = p_workspace_id and actor_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.analytics_project_role(p_project_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.analytics_project_members where project_id = p_project_id and actor_id = auth.uid() and status = 'active' limit 1),
    (select wm.role from public.analytics_projects p join public.analytics_workspace_members wm on wm.workspace_id = p.workspace_id where p.id = p_project_id and wm.actor_id = auth.uid() and wm.status = 'active' limit 1)
  )
$$;

create or replace function public.analytics_can_view_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.analytics_project_role(p_project_id) is not null
$$;

create or replace function public.analytics_can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.analytics_project_role(p_project_id) in ('owner','admin','manager','analyst')
$$;

create or replace function public.analytics_can_approve_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.analytics_project_role(p_project_id) in ('owner','admin','manager')
$$;

create or replace function public.analytics_can_manage_retention(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.analytics_project_role(p_project_id) in ('owner','admin')
$$;

create or replace function public.analytics_can_access_storage(p_bucket_id text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_bucket_id in ('analytics-raw','analytics-processed','analytics-model','analytics-prediction')
    and exists (
      select 1 from public.analytics_projects p
      where p.id::text = (storage.foldername(p_name))[3]
        and p.workspace_id = (storage.foldername(p_name))[1]
        and public.analytics_can_view_project(p.id)
    )
$$;

alter table public.analytics_projects enable row level security;
alter table public.analytics_datasets enable row level security;
alter table public.analytics_dataset_versions enable row level security;
alter table public.analytics_jobs enable row level security;
alter table public.analytics_lineage enable row level security;
alter table public.analytics_pipeline_templates enable row level security;
alter table public.analytics_pipeline_versions enable row level security;
alter table public.analytics_pipeline_runs enable row level security;
alter table public.analytics_pipeline_node_lineage enable row level security;
alter table public.analytics_quality_reports enable row level security;
alter table public.analytics_model_versions enable row level security;
alter table public.analytics_model_evaluations enable row level security;
alter table public.analytics_prediction_scenarios enable row level security;
alter table public.analytics_prediction_runs enable row level security;
alter table public.analytics_audit_events enable row level security;
alter table public.analytics_retention_policies enable row level security;
alter table public.analytics_cleanup_schedules enable row level security;
alter table public.analytics_workspace_members enable row level security;
alter table public.analytics_project_members enable row level security;
alter table public.analytics_drift_reports enable row level security;

-- The API/worker uses a server-only service key; authenticated direct access is narrowed
-- to the same project checks. Repeatable policies are dropped before recreation.
do $$ declare t text; begin
  foreach t in array array['analytics_dataset_versions','analytics_jobs','analytics_lineage','analytics_pipeline_templates','analytics_pipeline_versions','analytics_pipeline_runs','analytics_quality_reports','analytics_model_versions','analytics_prediction_scenarios','analytics_prediction_runs','analytics_audit_events','analytics_cleanup_schedules','analytics_drift_reports'] loop
    execute format('drop policy if exists analytics_project_read on public.%I', t);
    execute format('create policy analytics_project_read on public.%I for select to authenticated using (public.analytics_can_view_project(project_id))', t);
  end loop;
end $$;

drop policy if exists analytics_projects_read on public.analytics_projects;
create policy analytics_projects_read on public.analytics_projects for select to authenticated using (public.analytics_workspace_role(workspace_id) is not null);
drop policy if exists analytics_datasets_read on public.analytics_datasets;
create policy analytics_datasets_read on public.analytics_datasets for select to authenticated using (public.analytics_can_view_project(project_id));
drop policy if exists analytics_pipeline_node_lineage_read on public.analytics_pipeline_node_lineage;
create policy analytics_pipeline_node_lineage_read on public.analytics_pipeline_node_lineage for select to authenticated using (exists (select 1 from public.analytics_pipeline_runs r where r.id = pipeline_run_id and public.analytics_can_view_project(r.project_id)));
drop policy if exists analytics_model_evaluations_read on public.analytics_model_evaluations;
create policy analytics_model_evaluations_read on public.analytics_model_evaluations for select to authenticated using (exists (select 1 from public.analytics_model_versions m where m.id = model_version_id and public.analytics_can_view_project(m.project_id)));
drop policy if exists analytics_retention_read on public.analytics_retention_policies;
create policy analytics_retention_read on public.analytics_retention_policies for select to authenticated using (public.analytics_can_manage_retention(project_id));
drop policy if exists analytics_retention_update on public.analytics_retention_policies;
create policy analytics_retention_update on public.analytics_retention_policies for update to authenticated using (public.analytics_can_manage_retention(project_id)) with check (public.analytics_can_manage_retention(project_id));

drop policy if exists analytics_workspace_members_self_read on public.analytics_workspace_members;
create policy analytics_workspace_members_self_read on public.analytics_workspace_members for select to authenticated using (actor_id = auth.uid());
drop policy if exists analytics_project_members_read on public.analytics_project_members;
create policy analytics_project_members_read on public.analytics_project_members for select to authenticated using (public.analytics_can_approve_project(project_id));

update storage.buckets set public = false where id in ('analytics-raw','analytics-processed','analytics-model','analytics-prediction');
drop policy if exists analytics_private_read on storage.objects;
create policy analytics_private_read on storage.objects for select to authenticated using (public.analytics_can_access_storage(bucket_id, name));

comment on table public.analytics_workspace_members is 'A5 workspace RBAC membership. Backfill active members before enabling user traffic.';
comment on table public.analytics_drift_reports is 'Metadata-only model/data drift baseline and comparison reports; raw rows and artifacts remain in Storage.';
