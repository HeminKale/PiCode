-- Analytics Sprint A3 model and prediction metadata. Review and apply manually after 004.
-- Required extension: pgcrypto (already enabled by 001). This script is idempotent where
-- practical and never changes Prisma migrations, FlowOS tables, or Storage policies.
--
-- Manual recovery/rollback (only after confirming this Analytics metadata is disposable):
-- DROP TABLE IF EXISTS public.analytics_prediction_runs;
-- DROP TABLE IF EXISTS public.analytics_prediction_scenarios;
-- DROP TABLE IF EXISTS public.analytics_model_evaluations;
-- DROP TABLE IF EXISTS public.analytics_model_versions;
-- Do not delete any analytics-model or analytics-prediction Storage objects automatically;
-- reconcile immutable workspace/project paths manually before deleting metadata.

create table if not exists public.analytics_model_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  training_dataset_version_id uuid not null references public.analytics_dataset_versions(id) on delete restrict,
  job_id uuid not null references public.analytics_jobs(id) on delete restrict,
  contract_version text not null check (contract_version = 'analytics.v1'),
  model_family text not null check (model_family in ('ridge_linear', 'poisson_glm', 'histogram_gradient_boosting')),
  feature_set jsonb not null,
  artifact jsonb not null check ((artifact ->> 'bucket') = 'analytics-model' and coalesce(artifact ->> 'path', '') <> ''),
  data_fingerprint text not null check (char_length(data_fingerprint) = 64),
  selected_metrics jsonb not null,
  is_approved boolean not null default false,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (artifact)
);

create index if not exists analytics_model_versions_project_created_idx
  on public.analytics_model_versions (project_id, created_at desc);
create index if not exists analytics_model_versions_training_dataset_idx
  on public.analytics_model_versions (training_dataset_version_id, created_at desc);

create table if not exists public.analytics_model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.analytics_model_versions(id) on delete cascade,
  algorithm text not null check (algorithm in ('ridge_linear', 'poisson_glm', 'histogram_gradient_boosting')),
  metrics jsonb not null,
  segment_errors jsonb not null default '{}'::jsonb,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (model_version_id, algorithm)
);

create table if not exists public.analytics_prediction_scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  model_version_id uuid not null references public.analytics_model_versions(id) on delete restrict,
  mode text not null check (mode in ('historical_what_if', 'future_forecast')),
  horizon_weeks integer not null check (horizon_weeks = 4),
  scenario_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_prediction_scenarios_project_created_idx
  on public.analytics_prediction_scenarios (project_id, created_at desc);

create table if not exists public.analytics_prediction_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  scenario_id uuid not null references public.analytics_prediction_scenarios(id) on delete cascade,
  model_version_id uuid not null references public.analytics_model_versions(id) on delete restrict,
  history_dataset_version_id uuid not null references public.analytics_dataset_versions(id) on delete restrict,
  job_id uuid not null references public.analytics_jobs(id) on delete restrict,
  prediction_artifact jsonb not null check ((prediction_artifact ->> 'bucket') = 'analytics-prediction' and coalesce(prediction_artifact ->> 'path', '') <> ''),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  output_summary jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (prediction_artifact)
);

create index if not exists analytics_prediction_runs_project_created_idx
  on public.analytics_prediction_runs (project_id, created_at desc);

comment on table public.analytics_model_versions is
  'Immutable fixed-code model metadata. Serialized model artifacts stay only in private analytics-model Storage.';
comment on table public.analytics_prediction_runs is
  'Prediction metadata only. Full paired baseline/promotion rows stay only in private analytics-prediction Storage.';
