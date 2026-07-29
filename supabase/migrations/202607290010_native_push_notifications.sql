-- Editable notification preferences and automatic native push delivery.
--
-- The database queues privacy-safe alerts and pg_net hands them to Expo's Push
-- API asynchronously. Message bodies and private location details are never
-- copied into the push payload.

create extension if not exists pg_net with schema extensions;

revoke all privileges on public.device_push_tokens from authenticated;
grant all privileges on public.device_push_tokens to service_role;

create table if not exists public.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null check (
    category in (
      'proposals',
      'join_requests',
      'messages',
      'catch_updates',
      'nearby_activity',
      'rating_reminders'
    )
  ),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 180),
  data jsonb not null default '{}'::jsonb,
  request_id bigint,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create index if not exists push_notification_outbox_user_idx
on public.push_notification_outbox (user_id, created_at desc);

alter table public.push_notification_outbox enable row level security;
revoke all privileges on public.push_notification_outbox from anon, authenticated;
grant all privileges on public.push_notification_outbox to service_role;

create or replace function private.register_device_push_token(
  requested_token text,
  requested_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_token text := trim(coalesce(requested_token, ''));
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_platform not in ('ios', 'android') then
    raise exception 'Unknown device platform';
  end if;
  if char_length(normalized_token) > 500
    or normalized_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
  then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.device_push_tokens (
    user_id,
    token,
    platform,
    last_seen_at,
    revoked_at
  )
  values (
    caller_id,
    normalized_token,
    requested_platform,
    now(),
    null
  )
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    last_seen_at = excluded.last_seen_at,
    revoked_at = null;
end
$$;

create or replace function private.revoke_device_push_token(requested_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.device_push_tokens
  set revoked_at = now()
  where user_id = auth.uid()
    and token = requested_token;
end
$$;

create or replace function private.revoke_my_device_push_tokens()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.device_push_tokens
  set revoked_at = now()
  where user_id = auth.uid()
    and revoked_at is null;
end
$$;

create or replace function private.has_active_push_token()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.device_push_tokens token
      where token.user_id = auth.uid()
        and token.revoked_at is null
    )
$$;

create or replace function public.register_device_push_token(
  requested_token text,
  requested_platform text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.register_device_push_token(requested_token, requested_platform)
$$;

create or replace function public.revoke_device_push_token(requested_token text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_device_push_token(requested_token)
$$;

create or replace function public.revoke_my_device_push_tokens()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_my_device_push_tokens()
$$;

create or replace function public.has_active_push_token()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_active_push_token()
$$;

revoke all on function private.register_device_push_token(text, text)
from public, anon;
revoke all on function private.revoke_device_push_token(text)
from public, anon;
revoke all on function private.revoke_my_device_push_tokens()
from public, anon;
revoke all on function private.has_active_push_token()
from public, anon;

grant execute on function private.register_device_push_token(text, text)
to authenticated;
grant execute on function private.revoke_device_push_token(text)
to authenticated;
grant execute on function private.revoke_my_device_push_tokens()
to authenticated;
grant execute on function private.has_active_push_token()
to authenticated;

revoke all on function public.register_device_push_token(text, text)
from public, anon;
revoke all on function public.revoke_device_push_token(text)
from public, anon;
revoke all on function public.revoke_my_device_push_tokens()
from public, anon;
revoke all on function public.has_active_push_token()
from public, anon;

grant execute on function public.register_device_push_token(text, text)
to authenticated;
grant execute on function public.revoke_device_push_token(text)
to authenticated;
grant execute on function public.revoke_my_device_push_tokens()
to authenticated;
grant execute on function public.has_active_push_token()
to authenticated;

create or replace function private.push_preference_enabled(
  requested_user_id uuid,
  requested_category text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case requested_category
        when 'proposals' then preferences.proposals
        when 'join_requests' then preferences.join_requests
        when 'messages' then preferences.messages
        when 'catch_updates' then preferences.catch_updates
        when 'nearby_activity' then preferences.nearby_activity
        when 'rating_reminders' then preferences.rating_reminders
        else false
      end
      from public.notification_preferences preferences
      where preferences.user_id = requested_user_id
    ),
    true
  )
$$;

create or replace function private.queue_push_notification(
  requested_user_id uuid,
  requested_category text,
  requested_title text,
  requested_body text,
  requested_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_user_id is null
    or not private.push_preference_enabled(requested_user_id, requested_category)
    or not exists (
      select 1
      from public.device_push_tokens token
      where token.user_id = requested_user_id
        and token.revoked_at is null
    )
  then
    return;
  end if;

  insert into public.push_notification_outbox (
    user_id,
    category,
    title,
    body,
    data
  )
  values (
    requested_user_id,
    requested_category,
    left(requested_title, 100),
    left(requested_body, 180),
    coalesce(requested_data, '{}'::jsonb)
  );
end
$$;

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expo_messages jsonb;
  expo_request_id bigint;
begin
  select jsonb_agg(
    jsonb_build_object(
      'to', token.token,
      'title', new.title,
      'body', new.body,
      'data', new.data,
      'sound', 'default',
      'channelId', 'catch-updates'
    )
  )
  into expo_messages
  from public.device_push_tokens token
  where token.user_id = new.user_id
    and token.revoked_at is null;

  if expo_messages is null then
    return new;
  end if;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := expo_messages,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json',
      'Accept-Encoding', 'gzip, deflate'
    ),
    timeout_milliseconds := 5000
  )
  into expo_request_id;

  update public.push_notification_outbox
  set request_id = expo_request_id,
      dispatched_at = now()
  where id = new.id;
  return new;
exception
  when others then
    -- A delivery-provider outage must not break the Catch action that created
    -- this alert. An undispatched row remains available for operational review.
    return new;
end
$$;

drop trigger if exists dispatch_push_notification_after_insert
on public.push_notification_outbox;
create trigger dispatch_push_notification_after_insert
after insert on public.push_notification_outbox
for each row execute function private.dispatch_push_notification();

create or replace function private.push_proposal_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.catch_proposals%rowtype;
  target_id uuid;
  proposer_name text;
  activity_name text;
begin
  select * into proposal
  from public.catch_proposals
  where id = new.proposal_id;

  target_id := case
    when new.proposed_by = proposal.sender_id then proposal.recipient_id
    else proposal.sender_id
  end;
  select first_name into proposer_name
  from public.profiles
  where user_id = new.proposed_by;
  select name into activity_name
  from public.activity_types
  where id = new.activity_type_id;

  perform private.queue_push_notification(
    target_id,
    'proposals',
    case when new.revision = 1 then 'New Catch proposal' else 'Counterproposal received' end,
    coalesce(proposer_name, 'A Catch mate') || ' proposed a '
      || coalesce(activity_name, 'new') || ' Catch.',
    jsonb_build_object('path', '/proposals', 'proposalId', new.proposal_id)
  );
  return new;
end
$$;

create or replace function private.push_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  actor_name text;
  destination text := '/proposals';
begin
  if old.status is not distinct from new.status
    or new.status not in ('accepted', 'declined', 'withdrawn')
  then
    return new;
  end if;

  if new.status = 'withdrawn' then
    target_id := new.recipient_id;
    select first_name into actor_name from public.profiles where user_id = new.sender_id;
  else
    target_id := new.sender_id;
    select first_name into actor_name from public.profiles where user_id = new.recipient_id;
  end if;
  if new.status = 'accepted' and new.accepted_catch_id is not null then
    destination := '/catch/' || new.accepted_catch_id::text;
  end if;

  perform private.queue_push_notification(
    target_id,
    'proposals',
    case new.status
      when 'accepted' then 'Proposal accepted'
      when 'declined' then 'Proposal declined'
      else 'Proposal withdrawn'
    end,
    coalesce(actor_name, 'Your Catch mate') || ' updated your Catch proposal.',
    jsonb_build_object('path', destination, 'proposalId', new.id)
  );
  return new;
end
$$;

create or replace function private.push_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  host_id uuid;
  catch_title text;
  requester_name text;
begin
  if new.status <> 'requested' then
    return new;
  end if;
  select catch.host_id, catch.title
  into host_id, catch_title
  from public.catches catch
  where catch.id = new.catch_id;
  select first_name into requester_name
  from public.profiles
  where user_id = new.requester_id;

  perform private.queue_push_notification(
    host_id,
    'join_requests',
    'New join request',
    coalesce(requester_name, 'Someone nearby') || ' asked to join '
      || coalesce(catch_title, 'your Catch') || '.',
    jsonb_build_object(
      'path', '/catch-requests/' || new.catch_id::text,
      'catchId', new.catch_id
    )
  );
  return new;
end
$$;

create or replace function private.push_join_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status
    or new.status not in ('approved', 'declined')
  then
    return new;
  end if;
  perform private.queue_push_notification(
    new.requester_id,
    'join_requests',
    case when new.status = 'approved'
      then 'Join request approved'
      else 'Join request declined'
    end,
    case when new.status = 'approved'
      then 'You are in. Open Catch for the latest plan.'
      else 'The host responded to your Catch request.'
    end,
    jsonb_build_object(
      'path', '/catch/' || new.catch_id::text,
      'catchId', new.catch_id
    )
  );
  return new;
end
$$;

create or replace function private.push_contextual_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.kind <> 'user' or new.sender_id is null then
    return new;
  end if;

  -- A proposal revision can also copy its note into the conversation. The
  -- proposal alert already covers that event, so avoid sending two pushes.
  if new.proposal_id is not null and exists (
    select 1
    from public.proposal_revisions revision
    where revision.proposal_id = new.proposal_id
      and revision.proposed_by = new.sender_id
      and revision.created_at = new.created_at
      and trim(coalesce(revision.message, '')) = new.body
  ) then
    return new;
  end if;

  if new.proposal_id is not null then
    select case
      when proposal.sender_id = new.sender_id then proposal.recipient_id
      else proposal.sender_id
    end
    into recipient_id
    from public.catch_proposals proposal
    where proposal.id = new.proposal_id;

    perform private.queue_push_notification(
      recipient_id,
      'messages',
      'New Catch message',
      'You have a new message in a Catch conversation.',
      jsonb_build_object(
        'path', '/message/proposal/' || new.proposal_id::text,
        'threadType', 'proposal',
        'threadId', new.proposal_id
      )
    );
  elsif new.catch_id is not null then
    for recipient_id in
      select catch.host_id
      from public.catches catch
      where catch.id = new.catch_id
        and catch.host_id <> new.sender_id
      union
      select participant.user_id
      from public.catch_participants participant
      where participant.catch_id = new.catch_id
        and participant.user_id <> new.sender_id
        and participant.status in ('approved', 'attended')
    loop
      perform private.queue_push_notification(
        recipient_id,
        'messages',
        'New Catch message',
        'You have a new message in a Catch conversation.',
        jsonb_build_object(
          'path', '/message/catch/' || new.catch_id::text,
          'threadType', 'catch',
          'threadId', new.catch_id
        )
      );
    end loop;
  end if;
  return new;
end
$$;

create or replace function private.push_catch_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
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

create or replace function private.push_nearby_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_push_notification(
    new.user_id,
    'nearby_activity',
    'A Catch matches your availability',
    'Someone nearby made a Catch that sounds like a fit.',
    jsonb_build_object('path', '/matches', 'catchId', new.catch_id)
  );
  return new;
end
$$;

drop trigger if exists push_proposal_revision_after_insert
on public.proposal_revisions;
create trigger push_proposal_revision_after_insert
after insert on public.proposal_revisions
for each row execute function private.push_proposal_revision();

drop trigger if exists push_proposal_status_after_update
on public.catch_proposals;
create trigger push_proposal_status_after_update
after update of status on public.catch_proposals
for each row execute function private.push_proposal_status();

drop trigger if exists push_join_request_after_insert
on public.join_requests;
create trigger push_join_request_after_insert
after insert on public.join_requests
for each row execute function private.push_join_request();

drop trigger if exists push_join_request_status_after_update
on public.join_requests;
create trigger push_join_request_status_after_update
after update of status on public.join_requests
for each row execute function private.push_join_request_status();

drop trigger if exists push_contextual_message_after_insert
on public.catch_messages;
create trigger push_contextual_message_after_insert
after insert on public.catch_messages
for each row execute function private.push_contextual_message();

drop trigger if exists push_catch_update_after_update
on public.catches;
create trigger push_catch_update_after_update
after update of status, starts_at, venue_id, area_label on public.catches
for each row execute function private.push_catch_update();

drop trigger if exists push_nearby_match_after_insert
on public.catch_match_notifications;
create trigger push_nearby_match_after_insert
after insert on public.catch_match_notifications
for each row execute function private.push_nearby_match();

revoke all on function private.push_preference_enabled(uuid, text)
from public, anon, authenticated;
revoke all on function private.queue_push_notification(uuid, text, text, text, jsonb)
from public, anon, authenticated;
revoke all on function private.dispatch_push_notification()
from public, anon, authenticated;
revoke all on function private.push_proposal_revision()
from public, anon, authenticated;
revoke all on function private.push_proposal_status()
from public, anon, authenticated;
revoke all on function private.push_join_request()
from public, anon, authenticated;
revoke all on function private.push_join_request_status()
from public, anon, authenticated;
revoke all on function private.push_contextual_message()
from public, anon, authenticated;
revoke all on function private.push_catch_update()
from public, anon, authenticated;
revoke all on function private.push_nearby_match()
from public, anon, authenticated;
