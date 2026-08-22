-- P5: reusable account/device/IP rate-limit primitive.
-- The IP scope is restricted to trusted service-role callers because a mobile
-- client cannot prove its source IP to Postgres.

create schema if not exists private;

create table if not exists private.rate_limit_buckets (
  scope text not null check (scope in ('account', 'device', 'ip')),
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (scope, bucket_key)
);

revoke all on table private.rate_limit_buckets from public, anon, authenticated;

create or replace function private.rate_limit_reset_at(
  p_started_at timestamptz,
  p_window_seconds integer
)
returns timestamptz
language sql
immutable
as $$
  select p_started_at + make_interval(secs => p_window_seconds);
$$;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text default '',
  p_window_seconds integer default 60,
  p_limit integer default 10
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_scope text := lower(trim(coalesce(p_scope, '')));
  v_requested_key text := trim(coalesce(p_key, ''));
  v_bucket_key text;
  v_started_at timestamptz;
  v_count integer;
  v_reset_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_retry integer;
begin
  if v_scope not in ('account', 'device', 'ip') then
    raise exception 'Unsupported rate-limit scope.' using errcode = '22023';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Rate-limit window must be between 1 and 86400 seconds.' using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'Rate-limit limit must be between 1 and 10000.' using errcode = '22023';
  end if;

  if auth.role() = 'service_role' then
    if v_requested_key = '' then
      raise exception 'A key is required for service-role rate-limit calls.' using errcode = '22023';
    end if;
    v_bucket_key := v_requested_key;
  elsif v_scope = 'ip' then
    raise exception 'IP rate limits require a trusted service-role caller.' using errcode = '42501';
  elsif auth.uid() is null then
    raise exception 'Authentication is required for account/device rate limits.' using errcode = '42501';
  elsif v_scope = 'account' then
    v_bucket_key := auth.uid()::text;
  elsif v_requested_key = '' then
    raise exception 'A device key is required.' using errcode = '22023';
  else
    v_bucket_key := auth.uid()::text || ':' || v_requested_key;
  end if;

  insert into private.rate_limit_buckets (scope, bucket_key, window_started_at, request_count)
  values (v_scope, v_bucket_key, v_now, 0)
  on conflict (scope, bucket_key) do nothing;

  select bucket.window_started_at, bucket.request_count
    into v_started_at, v_count
    from private.rate_limit_buckets as bucket
   where bucket.scope = v_scope
     and bucket.bucket_key = v_bucket_key
   for update;

  v_reset_at := private.rate_limit_reset_at(v_started_at, p_window_seconds);

  if v_now >= v_reset_at then
    update private.rate_limit_buckets
       set window_started_at = v_now,
           request_count = 1
     where scope = v_scope and bucket_key = v_bucket_key;

    return query select true, p_limit - 1, 0, private.rate_limit_reset_at(v_now, p_window_seconds);
    return;
  end if;

  if v_count >= p_limit then
    v_retry := greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return query select false, 0, v_retry, v_reset_at;
    return;
  end if;

  update private.rate_limit_buckets
     set request_count = request_count + 1
   where scope = v_scope and bucket_key = v_bucket_key;

  return query select true, p_limit - v_count - 1, 0, v_reset_at;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to authenticated, service_role;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Atomic fixed-window throttle for account, device, and trusted service-role IP scopes. The mobile client cannot submit an IP scope.';
