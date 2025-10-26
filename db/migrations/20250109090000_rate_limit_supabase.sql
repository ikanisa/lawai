create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.rate_limit_counters is 'Tracks request counts for distributed rate limiting.';

create index if not exists rate_limit_counters_reset_idx on public.rate_limit_counters (reset_at);

create or replace function public.rate_limit_hit(
  identifier text,
  limit integer,
  window_seconds integer,
  weight integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  new_reset_at timestamptz := now_ts + make_interval(secs => window_seconds);
  snapshot record;
  allowed boolean;
  remaining integer;
begin
  if identifier is null or length(identifier) = 0 then
    raise exception 'identifier must be provided';
  end if;
  if limit is null or limit <= 0 then
    raise exception 'limit must be positive';
  end if;
  if window_seconds is null or window_seconds <= 0 then
    raise exception 'window_seconds must be positive';
  end if;
  if weight is null or weight <= 0 then
    raise exception 'weight must be positive';
  end if;

  insert into public.rate_limit_counters as counters (key, count, reset_at, updated_at)
  values(identifier, weight, new_reset_at, now_ts)
  on conflict (key) do update
    set
      count = case
        when counters.reset_at <= now_ts then weight
        else counters.count + weight
      end,
      reset_at = case
        when counters.reset_at <= now_ts then new_reset_at
        else counters.reset_at
      end,
      updated_at = now_ts
  returning counters.count, counters.reset_at into snapshot;

  allowed := snapshot.count <= limit;
  if allowed then
    remaining := greatest(limit - snapshot.count, 0);
  else
    remaining := 0;
  end if;

  return jsonb_build_object(
    'allowed', allowed,
    'remaining', remaining,
    'reset_at', snapshot.reset_at
  );
end;
$$;

create or replace function public.rate_limit_reset(identifier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rate_limit_counters where key = identifier;
end;
$$;
