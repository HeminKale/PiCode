-- Analytics Sprint A1 foundation. Review and apply manually in Supabase SQL Editor.
-- Required extension: pgcrypto (enabled below for gen_random_uuid()).
-- This script is idempotent where practical. It does not alter Prisma migrations or
-- FlowOS tables, and it intentionally does not create Storage RLS policies.
--
-- Rollback/manual recovery:
--   Only use the DROP statements below after confirming no Analytics data must be kept.
--   Storage objects are deliberately not deleted by this SQL; reconcile any orphaned
--   objects under workspace/project paths in the private analytics-* buckets manually.
--
-- BEGIN MANUAL ROLLBACK (do not run as part of this migration):
-- DROP TABLE IF EXISTS public.analytics_lineage;
-- DROP TABLE IF EXISTS public.analytics_jobs;
-- DROP TABLE IF EXISTS public.analytics_dataset_versions;
-- DROP TABLE IF EXISTS public.analytics_datasets;
-- DROP TABLE IF EXISTS public.analytics_projects;
-- END MANUAL ROLLBACK

create extension if not exists pgcrypto;

create table if not exists public.analytics_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_projects_workspace_updated_idx
  on public.analytics_projects (workspace_id, updated_at desc);

create table if not exists public.analytics_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.analytics_dataset_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  dataset_id uuid not null references public.analytics_datasets(id) on delete cascade,
  file_name text not null,
  content_type text not null check (content_type = 'text/csv'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  storage_bucket text not null check (storage_bucket = 'analytics-raw'),
  storage_path text not null,
  sha256 text not null check (char_length(sha256) = 64),
  status text not null check (status in ('uploading', 'profiled', 'failed')),
  profile jsonb,
  column_mappings jsonb not null default '[]'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check ((status = 'profiled' and profile is not null) or status in ('uploading', 'failed'))
);

create index if not exists analytics_dataset_versions_project_created_idx
  on public.analytics_dataset_versions (project_id, created_at desc);
create index if not exists analytics_dataset_versions_dataset_created_idx
  on public.analytics_dataset_versions (dataset_id, created_at desc);

create table if not exists public.analytics_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  contract_version text not null check (contract_version = 'analytics.v1'),
  job_type text not null check (job_type in ('PROFILE_DATASET', 'PROCESS_DATASET', 'TRAIN_MODEL', 'PREDICT')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input_artifacts jsonb not null default '[]'::jsonb,
  output_artifacts jsonb not null default '[]'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists analytics_jobs_project_created_idx
  on public.analytics_jobs (project_id, created_at desc);

create table if not exists public.analytics_lineage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  relationship text not null check (relationship in ('derived_from', 'trained_from', 'predicted_from')),
  input_dataset_version_id uuid references public.analytics_dataset_versions(id) on delete set null,
  output_dataset_version_id uuid references public.analytics_dataset_versions(id) on delete set null,
  job_id uuid references public.analytics_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (input_dataset_version_id is not null or output_dataset_version_id is not null or job_id is not null)
);

create index if not exists analytics_lineage_project_created_idx
  on public.analytics_lineage (project_id, created_at desc);

comment on table public.analytics_projects is 'Analytics feature metadata; raw data stays in private Supabase Storage.';
comment on table public.analytics_dataset_versions is 'Immutable raw CSV versions; no CSV rows are stored here.';
comment on table public.analytics_jobs is 'Versioned fixed-code analytics worker jobs.';
