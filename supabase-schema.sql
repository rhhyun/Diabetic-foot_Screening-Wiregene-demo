create extension if not exists pgcrypto;

create table if not exists public.research_records (
  id uuid primary key default gen_random_uuid(),
  record_id text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  patient_summary jsonb not null default '{}'::jsonb,
  app_risk_class integer not null default 0,
  active_concern boolean not null default false,
  record_payload jsonb not null
);

create index if not exists research_records_updated_at_idx
  on public.research_records (updated_at desc);

create index if not exists research_records_risk_idx
  on public.research_records (app_risk_class desc, updated_at desc);

create or replace function public.set_research_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_research_records_updated_at on public.research_records;

create trigger trg_research_records_updated_at
before update on public.research_records
for each row
execute function public.set_research_records_updated_at();

alter table public.research_records enable row level security;

comment on table public.research_records is
'Wiregene diabetic foot screening records stored by Node API + Supabase.';
