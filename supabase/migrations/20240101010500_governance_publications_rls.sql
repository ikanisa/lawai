alter table public.governance_publications enable row level security;

-- Publications are meant to be public; allow read access to all while
-- delegating write access to service role flows controlled by Supabase.
drop policy if exists "governance publications read" on public.governance_publications;
create policy "governance publications read" on public.governance_publications
  for select using (true);

drop policy if exists "governance publications service write" on public.governance_publications;
create policy "governance publications service write" on public.governance_publications
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
