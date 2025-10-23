DO $do$
begin
  if exists (
    select 1
    from public.jurisdictions
    where code = 'QC'
  ) then
    update public.jurisdictions
    set code = 'CA-QC'
    where code = 'QC';

    update public.authority_domains
    set jurisdiction_code = 'CA-QC'
    where jurisdiction_code = 'QC';
  end if;

  if not exists (
    select 1 from public.jurisdictions where code = 'OAPI'
  ) then
    insert into public.jurisdictions (code, name, eu, ohada)
    values ('OAPI', 'Organisation africaine de la propriété intellectuelle', false, false);
  end if;

  if not exists (
    select 1 from public.jurisdictions where code = 'CIMA'
  ) then
    insert into public.jurisdictions (code, name, eu, ohada)
    values ('CIMA', 'Conférence interafricaine des marchés d''assurances', false, false);
  end if;
end;
$do$;
