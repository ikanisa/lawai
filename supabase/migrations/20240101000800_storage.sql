-- Configure Supabase storage buckets and RLS policies for authorities ingestion
insert into storage.buckets (id, name, public)
values
  ('authorities', 'authorities', false),
  ('uploads', 'uploads', false),
  ('snapshots', 'snapshots', false)
on conflict (id) do nothing;

create or replace function public.storage_object_org(path text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
  result uuid;
begin
  if path is null then
    return null;
  end if;

  first_segment := split_part(path, '/', 1);

  if first_segment is null or first_segment = '' then
    return null;
  end if;

  begin
    result := first_segment::uuid;
    return result;
  exception when others then
    return null;
  end;
end;
$$;

do $do$
declare
  owns_table boolean;
begin
  select pg_get_userbyid(c.relowner) = current_user
    into owns_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname = 'objects';

  if owns_table then
    execute $$alter table storage.objects enable row level security$$;

    execute $$drop policy if exists "Org members read authorities" on storage.objects$$;
    execute $$create policy "Org members read authorities" on storage.objects
      for select using (
        bucket_id = 'authorities'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members upload authorities" on storage.objects$$;
    execute $$create policy "Org members upload authorities" on storage.objects
      for insert with check (
        bucket_id = 'authorities'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members manage authorities" on storage.objects$$;
    execute $$create policy "Org members manage authorities" on storage.objects
      for update using (
        bucket_id = 'authorities'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )
      with check (
        bucket_id = 'authorities'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members delete authorities" on storage.objects$$;
    execute $$create policy "Org members delete authorities" on storage.objects
      for delete using (
        bucket_id = 'authorities'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members read uploads" on storage.objects$$;
    execute $$create policy "Org members read uploads" on storage.objects
      for select using (
        bucket_id = 'uploads'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members write uploads" on storage.objects$$;
    execute $$create policy "Org members write uploads" on storage.objects
      for all using (
        bucket_id = 'uploads'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      ) with check (
        bucket_id = 'uploads'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;

    execute $$drop policy if exists "Org members manage snapshots" on storage.objects$$;
    execute $$create policy "Org members manage snapshots" on storage.objects
      for all using (
        bucket_id = 'snapshots'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      ) with check (
        bucket_id = 'snapshots'
        and public.storage_object_org(name) is not null
        and public.is_org_member(public.storage_object_org(name))
      )$$;
  end if;
end
$do$;
