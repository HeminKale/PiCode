-- Analytics Sprint A2 processed-dataset lifecycle. Review and apply manually after 003.
-- This is a follow-up migration because 001 and 003 may already be applied. Do not edit them.
-- Required extension: pgcrypto (already enabled by 001). This script does not touch Prisma.
--
-- Manual recovery/rollback (only after confirming no processed Analytics metadata is needed):
--   Drop the named constraints created below, then restore the original 001 constraints.
--   Do not delete Storage objects automatically; reconcile private analytics-processed paths manually.

do $$
declare constraint_name text;
begin
  -- 001 used unnamed CHECK constraints. Remove only the three checks it defined so
  -- processed immutable versions can use analytics-processed and processing states.
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.analytics_dataset_versions'::regclass
      and contype = 'c'
      and (
        lower(pg_get_constraintdef(oid)) like '%storage_bucket = ''analytics-raw''%'
        or lower(pg_get_constraintdef(oid)) like '%status = any (array[''uploading''%'
        or lower(pg_get_constraintdef(oid)) like '%status = ''profiled''%profile is not null%'
      )
  loop
    execute format('alter table public.analytics_dataset_versions drop constraint if exists %I', constraint_name);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'analytics_dataset_versions_storage_bucket_check') then
    alter table public.analytics_dataset_versions add constraint analytics_dataset_versions_storage_bucket_check
      check (storage_bucket in ('analytics-raw', 'analytics-processed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analytics_dataset_versions_status_check') then
    alter table public.analytics_dataset_versions add constraint analytics_dataset_versions_status_check
      check (status in ('uploading', 'profiled', 'processing', 'processed', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analytics_dataset_versions_profile_status_check') then
    alter table public.analytics_dataset_versions add constraint analytics_dataset_versions_profile_status_check
      check (
        (status = 'profiled' and storage_bucket = 'analytics-raw' and profile is not null)
        or (status = 'processed' and storage_bucket = 'analytics-processed' and profile is not null)
        or status in ('uploading', 'processing', 'failed')
      );
  end if;
end $$;

comment on table public.analytics_dataset_versions is
  'Immutable Analytics CSV versions. Raw and processed data stay in private Supabase Storage; rows are never stored in FlowOS flowJson.';
