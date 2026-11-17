-- Durable, retryable AI generation jobs and per-window outputs.
-- All records are server-owned; client roles receive no table privileges.

create table if not exists public.vow_ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null references public.goals(id) on delete set null,
  request_id uuid not null unique,
  tier text not null check (tier in ('free', 'premium')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  duration_weeks smallint not null check (duration_weeks between 1 and 52),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  selected_days text[] not null,
  complexity numeric(4,2) not null default 1.0 check (complexity between 0.75 and 1.80),
  skeleton jsonb null,
  final_plan jsonb null,
  knowledge_status text not null default 'pending'
    check (knowledge_status in ('pending', 'complete', 'timed_out', 'failed', 'skipped')),
  estimated_input_tokens bigint not null default 0,
  estimated_output_tokens bigint not null default 0,
  actual_input_tokens bigint not null default 0,
  actual_output_tokens bigint not null default 0,
  provider_cost_usd numeric(12,6) not null default 0,
  error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.vow_ai_generation_windows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.vow_ai_generation_jobs(id) on delete cascade,
  window_index smallint not null check (window_index >= 0),
  start_week smallint not null check (start_week between 1 and 52),
  end_week smallint not null check (end_week between start_week and 52),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  output_budget_tokens integer not null check (output_budget_tokens >= 1200),
  provider text null check (provider is null or provider in ('groq', 'mistral', 'nova')),
  finish_reason text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  retry_count smallint not null default 0 check (retry_count between 0 and 3),
  validation_error text null,
  output jsonb null,
  error_code text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, window_index)
);

alter table public.vow_ai_request_leases
  add column if not exists tier text not null default 'free'
    check (tier in ('free', 'premium')),
  add column if not exists lane text not null default 'free'
    check (lane in ('free', 'premium')),
  add column if not exists generation_job_id uuid null
    references public.vow_ai_generation_jobs(id) on delete set null;

create index if not exists vow_ai_generation_jobs_user_created_idx
  on public.vow_ai_generation_jobs(user_id, created_at desc);
create index if not exists vow_ai_generation_jobs_status_created_idx
  on public.vow_ai_generation_jobs(status, created_at);
create index if not exists vow_ai_generation_windows_job_status_idx
  on public.vow_ai_generation_windows(job_id, status, window_index);

alter table public.vow_ai_generation_jobs enable row level security;
alter table public.vow_ai_generation_windows enable row level security;
revoke all on public.vow_ai_generation_jobs from anon, authenticated;
revoke all on public.vow_ai_generation_windows from anon, authenticated;
grant all on public.vow_ai_generation_jobs to service_role;
grant all on public.vow_ai_generation_windows to service_role;

comment on table public.vow_ai_generation_jobs is
  'Server-owned durable state for staged VOW goal-plan generation. No client access.';
comment on table public.vow_ai_generation_windows is
  'Server-owned per-window generation output and retry state. No client access.';
