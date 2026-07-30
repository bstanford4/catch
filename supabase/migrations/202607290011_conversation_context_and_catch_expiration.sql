-- Clearer conversation lifecycle and automatic expiration for unattended open
-- Catches. Confirmed Catches remain available for the later completion flow.

create extension if not exists pg_cron with schema extensions;

create or replace function private.expire_stale_catches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.catches catch
  set status = 'expired',
      updated_at = now()
  where catch.status in ('open', 'full')
    and catch.starts_at
      + make_interval(mins => catch.duration_minutes) <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end
$$;

create or replace function private.write_catch_status_system_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    and new.status in ('canceled', 'completed', 'expired')
  then
    insert into public.catch_messages (catch_id, kind, body)
    values (
      new.id,
      'system',
      case
        when new.status = 'canceled' then 'This Catch was canceled.'
        when new.status = 'expired' then 'This Catch has ended.'
        else 'This Catch was marked complete.'
      end
    );
  end if;
  return new;
end
$$;

-- Expiration is routine cleanup, not a plan change that should buzz every
-- participant after the scheduled end time.
create or replace function private.push_catch_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.status = 'expired' then
    return new;
  end if;
  if old.status is not distinct from new.status
    and old.starts_at is not distinct from new.starts_at
    and old.venue_id is not distinct from new.venue_id
    and old.area_label is not distinct from new.area_label
  then
    return new;
  end if;

  for recipient_id in
    select participant.user_id
    from public.catch_participants participant
    where participant.catch_id = new.id
      and participant.user_id <> new.host_id
      and participant.status in ('approved', 'attended')
  loop
    perform private.queue_push_notification(
      recipient_id,
      'catch_updates',
      case when new.status = 'canceled' then 'Catch canceled' else 'Catch updated' end,
      case when new.status = 'canceled'
        then 'A Catch you joined was canceled.'
        else 'Open Catch to review the latest plan.'
      end,
      jsonb_build_object('path', '/catch/' || new.id::text, 'catchId', new.id)
    );
  end loop;
  return new;
end
$$;

revoke all on function private.expire_stale_catches()
from public, anon, authenticated;
revoke all on function private.write_catch_status_system_message()
from public, anon, authenticated;
revoke all on function private.push_catch_update()
from public, anon, authenticated;

-- A named schedule is safely updated instead of duplicated if this migration is
-- re-applied during development.
select cron.schedule(
  'catch-expire-stale-open-catches',
  '*/5 * * * *',
  'select private.expire_stale_catches()'
);

-- Correct existing test records immediately instead of waiting for the first
-- scheduled run.
select private.expire_stale_catches();
