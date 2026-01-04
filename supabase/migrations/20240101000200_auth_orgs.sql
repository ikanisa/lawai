create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text,
  locale text default 'fr',
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members
    where org_id = p_org
      and user_id = auth.uid()
  );
$$;
