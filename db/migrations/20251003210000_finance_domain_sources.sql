CREATE OR REPLACE FUNCTION public.set_updated_at () returns trigger language plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS public.finance_tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'prepared',
      'submitted',
      'audit',
      'closed'
    )
  ),
  amount numeric,
  currency text,
  due_date date,
  submitted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS finance_tax_filings_org_period_idx ON public.finance_tax_filings (org_id, jurisdiction, period);

CREATE TRIGGER set_finance_tax_filings_updated_at before
UPDATE ON public.finance_tax_filings FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.finance_ap_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  vendor text NOT NULL,
  invoice_number text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'approved',
      'scheduled',
      'paid',
      'rejected'
    )
  ),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected')
  ),
  invoice_date date,
  due_date date,
  payment_scheduled_for date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS finance_ap_invoices_org_status_idx ON public.finance_ap_invoices (org_id, status, due_date);

CREATE TRIGGER set_finance_ap_invoices_updated_at before
UPDATE ON public.finance_ap_invoices FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.finance_audit_walkthroughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  process_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ready', 'review', 'completed')
  ),
  owner_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS finance_audit_walkthroughs_org_idx ON public.finance_audit_walkthroughs (org_id, process_name);

CREATE TRIGGER set_finance_audit_walkthroughs_updated_at before
UPDATE ON public.finance_audit_walkthroughs FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.finance_risk_control_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  control_id text NOT NULL,
  result text NOT NULL CHECK (result IN ('passed', 'failed', 'not_tested')),
  tested_at timestamptz NOT NULL DEFAULT now(),
  tester_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS finance_risk_control_tests_org_idx ON public.finance_risk_control_tests (org_id, control_id, tested_at DESC);

CREATE TRIGGER set_finance_risk_control_tests_updated_at before
UPDATE ON public.finance_risk_control_tests FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.finance_board_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'shared')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX if NOT EXISTS finance_board_packs_org_period_idx ON public.finance_board_packs (org_id, period);

CREATE TRIGGER set_finance_board_packs_updated_at before
UPDATE ON public.finance_board_packs FOR each ROW
EXECUTE procedure public.set_updated_at ();

CREATE TABLE IF NOT EXISTS public.finance_regulatory_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  filing_type text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (
    status IN (
      'planned',
      'in_progress',
      'submitted',
      'accepted',
      'rejected'
    )
  ),
  submitted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX if NOT EXISTS finance_regulatory_filings_org_idx ON public.finance_regulatory_filings (org_id, jurisdiction, filing_type, due_date);

CREATE TRIGGER set_finance_regulatory_filings_updated_at before
UPDATE ON public.finance_regulatory_filings FOR each ROW
EXECUTE procedure public.set_updated_at ();

ALTER TABLE public.finance_tax_filings enable ROW level security;

ALTER TABLE public.finance_ap_invoices enable ROW level security;

ALTER TABLE public.finance_audit_walkthroughs enable ROW level security;

ALTER TABLE public.finance_risk_control_tests enable ROW level security;

ALTER TABLE public.finance_board_packs enable ROW level security;

ALTER TABLE public.finance_regulatory_filings enable ROW level security;

CREATE POLICY if NOT EXISTS finance_tax_filings_access ON public.finance_tax_filings FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY if NOT EXISTS finance_ap_invoices_access ON public.finance_ap_invoices FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY if NOT EXISTS finance_audit_walkthroughs_access ON public.finance_audit_walkthroughs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY if NOT EXISTS finance_risk_control_tests_access ON public.finance_risk_control_tests FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY if NOT EXISTS finance_board_packs_access ON public.finance_board_packs FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));

CREATE POLICY if NOT EXISTS finance_regulatory_filings_access ON public.finance_regulatory_filings FOR ALL USING (public.is_org_member (org_id))
WITH
  CHECK (public.is_org_member (org_id));
