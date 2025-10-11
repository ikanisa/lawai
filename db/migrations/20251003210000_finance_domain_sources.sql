create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.finance_tax_filings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  jurisdiction text not null,
  period text not null,
  status text not null default 'draft' check (status in ('draft','prepared','submitted','audit','closed')),
  amount numeric,
  currency text,
  due_date date,
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_tax_filings_org_period_idx
  on public.finance_tax_filings (org_id, jurisdiction, period);

create trigger set_finance_tax_filings_updated_at
  before update on public.finance_tax_filings
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.finance_ap_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor text not null,
  invoice_number text,
  amount numeric not null,
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending','approved','scheduled','paid','rejected')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  invoice_date date,
  due_date date,
  payment_scheduled_for date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_ap_invoices_org_status_idx
  on public.finance_ap_invoices (org_id, status, due_date);

create trigger set_finance_ap_invoices_updated_at
  before update on public.finance_ap_invoices
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.finance_audit_walkthroughs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  process_name text not null,
  status text not null default 'draft' check (status in ('draft','ready','review','completed')),
  owner_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_audit_walkthroughs_org_idx
  on public.finance_audit_walkthroughs (org_id, process_name);

create trigger set_finance_audit_walkthroughs_updated_at
  before update on public.finance_audit_walkthroughs
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.finance_risk_control_tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  control_id text not null,
  result text not null check (result in ('passed','failed','not_tested')),
  tested_at timestamptz not null default now(),
  tester_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_risk_control_tests_org_idx
  on public.finance_risk_control_tests (org_id, control_id, tested_at desc);

create trigger set_finance_risk_control_tests_updated_at
  before update on public.finance_risk_control_tests
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.finance_board_packs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period text not null,
  status text not null default 'draft' check (status in ('draft','ready','shared')),
  metrics jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_board_packs_org_period_idx
  on public.finance_board_packs (org_id, period);

create trigger set_finance_board_packs_updated_at
  before update on public.finance_board_packs
  for each row
  execute procedure public.set_updated_at();

create table if not exists public.finance_regulatory_filings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  jurisdiction text not null,
  filing_type text not null,
  due_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','submitted','accepted','rejected')),
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_regulatory_filings_org_idx
  on public.finance_regulatory_filings (org_id, jurisdiction, filing_type, due_date);

create trigger set_finance_regulatory_filings_updated_at
  before update on public.finance_regulatory_filings
  for each row
  execute procedure public.set_updated_at();

alter table public.finance_tax_filings enable row level security;
alter table public.finance_ap_invoices enable row level security;
alter table public.finance_audit_walkthroughs enable row level security;
alter table public.finance_risk_control_tests enable row level security;
alter table public.finance_board_packs enable row level security;
alter table public.finance_regulatory_filings enable row level security;

create policy if not exists finance_tax_filings_access on public.finance_tax_filings
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists finance_ap_invoices_access on public.finance_ap_invoices
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists finance_audit_walkthroughs_access on public.finance_audit_walkthroughs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists finance_risk_control_tests_access on public.finance_risk_control_tests
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists finance_board_packs_access on public.finance_board_packs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy if not exists finance_regulatory_filings_access on public.finance_regulatory_filings
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
