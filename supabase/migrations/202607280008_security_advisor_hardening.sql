-- Security Advisor hardening for the exposed public schema.
--
-- PostGIS was originally installed in public. Its catalog and functions are
-- owned by Supabase's administrative role, so project migrations cannot alter
-- them safely. Moving or hardening those extension-owned objects requires
-- Supabase Support or a backed-up extension reinstall and is tracked separately.

-- The project-owned event-trigger function does not need to be callable through
-- the Data API. Revoking EXECUTE does not disable the automatic RLS event trigger.
revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

-- Cache auth.uid() once per statement in RLS policies. This preserves the same
-- authorization behavior while avoiding a per-row Auth function evaluation.

drop policy if exists "profiles own write" on public.profiles;
create policy "profiles own write"
on public.profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "activity preferences own rows"
on public.user_activity_preferences;
create policy "activity preferences own rows"
on public.user_activity_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "availability own rows" on public.availability_windows;
create policy "availability own rows"
on public.availability_windows for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "equipment own rows" on public.equipment_items;
create policy "equipment own rows"
on public.equipment_items for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "equipment photos follow ownership"
on public.equipment_photos;
create policy "equipment photos follow ownership"
on public.equipment_photos for all to authenticated
using (
  exists (
    select 1
    from public.equipment_items equipment
    where equipment.id = equipment_photos.equipment_item_id
      and equipment.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.equipment_items equipment
    where equipment.id = equipment_photos.equipment_item_id
      and equipment.owner_id = (select auth.uid())
  )
);

drop policy if exists "blocks own rows" on public.blocks;
create policy "blocks own rows"
on public.blocks for all to authenticated
using (blocker_id = (select auth.uid()))
with check (blocker_id = (select auth.uid()));

drop policy if exists "reports own insert" on public.reports;
create policy "reports own insert"
on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "reports own read" on public.reports;
create policy "reports own read"
on public.reports for select to authenticated
using (reporter_id = (select auth.uid()));

drop policy if exists "notification preferences own rows"
on public.notification_preferences;
create policy "notification preferences own rows"
on public.notification_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "push tokens own rows" on public.device_push_tokens;
create policy "push tokens own rows"
on public.device_push_tokens for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "participants read catch messages"
on public.catch_messages;
create policy "participants read catch messages"
on public.catch_messages for select to authenticated
using (
  catch_id is not null
  and exists (
    select 1
    from public.catch_participants participant
    where participant.catch_id = catch_messages.catch_id
      and participant.user_id = (select auth.uid())
      and participant.status in ('approved', 'attended')
  )
);

drop policy if exists "participants send catch messages"
on public.catch_messages;
create policy "participants send catch messages"
on public.catch_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and catch_id is not null
  and exists (
    select 1
    from public.catch_participants participant
    where participant.catch_id = catch_messages.catch_id
      and participant.user_id = (select auth.uid())
      and participant.status = 'approved'
  )
);

-- Consolidate overlapping SELECT policies while preserving host, participant,
-- and public-discovery access. Write operations remain host-only.

drop policy if exists "hosts manage catches" on public.catches;
drop policy if exists "participants read catches" on public.catches;
drop policy if exists "authenticated discover public catches" on public.catches;
drop policy if exists "members read permitted catches" on public.catches;
drop policy if exists "hosts create catches" on public.catches;
drop policy if exists "hosts update catches" on public.catches;
drop policy if exists "hosts delete catches" on public.catches;

create policy "members read permitted catches"
on public.catches for select to authenticated
using (
  host_id = (select auth.uid())
  or exists (
    select 1
    from public.catch_participants participant
    where participant.catch_id = catches.id
      and participant.user_id = (select auth.uid())
      and participant.status in ('approved', 'attended')
  )
  or (
    visibility = 'public'
    and status in ('open', 'full')
    and starts_at > now()
    and host_id <> (select auth.uid())
    and not private.users_blocked(host_id, (select auth.uid()))
    and (
      minimum_age = 18
      or exists (
        select 1
        from public.profiles profile
        where profile.user_id = (select auth.uid())
          and profile.age_21_affirmed_at is not null
      )
    )
  )
);

create policy "hosts create catches"
on public.catches for insert to authenticated
with check (host_id = (select auth.uid()));

create policy "hosts update catches"
on public.catches for update to authenticated
using (host_id = (select auth.uid()))
with check (host_id = (select auth.uid()));

create policy "hosts delete catches"
on public.catches for delete to authenticated
using (host_id = (select auth.uid()));

drop policy if exists "requesters read own join requests"
on public.join_requests;
drop policy if exists "hosts read catch join requests"
on public.join_requests;
drop policy if exists "members read permitted join requests"
on public.join_requests;

create policy "members read permitted join requests"
on public.join_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or exists (
    select 1
    from public.catches catch
    where catch.id = join_requests.catch_id
      and catch.host_id = (select auth.uid())
  )
);
