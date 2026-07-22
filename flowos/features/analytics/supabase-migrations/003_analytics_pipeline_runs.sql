-- Analytics Sprint A2 pipeline metadata. Review and apply manually after 001.
-- Required extension: pgcrypto (already enabled by 001).
-- This script is idempotent where practical and does not touch Prisma migrations.
--
-- Manual recovery/rollback (only after confirming Analytics pipeline metadata is disposable):
-- DROP TABLE IF EXISTS public.analytics_quality_reports;
-- DROP TABLE IF EXISTS public.analytics_pipeline_node_lineage;
-- DROP TABLE IF EXISTS public.analytics_pipeline_runs;
-- DROP TABLE IF EXISTS public.analytics_pipeline_versions;
-- DROP TABLE IF EXISTS public.analytics_pipeline_templates;

create table if not exists public.analytics_pipeline_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.analytics_pipeline_versions (
  id uuid primary key default gen_random_uuid(),
  pipeline_template_id uuid not null references public.analytics_pipeline_templates(id) on delete cascade,
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  version integer not null check (version > 0),
  contract_version text not null check (contract_version = 'analytics.v1'),
  definition jsonb not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pipeline_template_id, version)
);

create index if not exists analytics_pipeline_versions_project_created_idx
  on public.analytics_pipeline_versions (project_id, created_at desc);

create table if not exists public.analytics_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  pipeline_version_id uuid not null references public.analytics_pipeline_versions(id) on delete restrict,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input_dataset_version_ids jsonb not null default '[]'::jsonb,
  output_dataset_version_id uuid references public.analytics_dataset_versions(id) on delete set null,
  worker_job_id uuid references public.analytics_jobs(id) on delete set null,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists analytics_pipeline_runs_project_created_idx
  on public.analytics_pipeline_runs (project_id, created_at desc);

create table if not exists public.analytics_pipeline_node_lineage (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.analytics_pipeline_runs(id) on delete cascade,
  node_id text not null,
  input_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (pipeline_run_id, node_id)
);

create table if not exists public.analytics_quality_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  pipeline_run_id uuid not null unique references public.analytics_pipeline_runs(id) on delete cascade,
  report jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.analytics_pipeline_versions is 'Immutable reviewed analytics.v1 pipeline definitions.';
comment on table public.analytics_pipeline_runs is 'Fixed-code worker runs; raw rows stay in Storage.';
