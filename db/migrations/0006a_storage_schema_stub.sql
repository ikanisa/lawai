do
$$
begin
  create schema if not exists storage;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    create table storage.buckets (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      owner uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      public boolean not null default false,
      avif_autodetection boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      name text not null,
      owner uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_accessed_at timestamptz,
      metadata jsonb,
      path_tokens text[]
    );
  end if;
end;
$$;
