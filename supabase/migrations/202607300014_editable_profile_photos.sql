-- Editable member profiles and private profile photos.
-- Photo objects are stored at <owner-id>/<random-name>.jpg. Owners control
-- uploads and deletion; only Catch Mates or approved shared-Catch members can
-- obtain temporary signed read URLs.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile photo owners can upload" on storage.objects;
create policy "profile photo owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "profile photo owners can update" on storage.objects;
create policy "profile photo owners can update"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "profile photo owners can delete" on storage.objects;
create policy "profile photo owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "connected members can read profile photos" on storage.objects;
create policy "connected members can read profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or (
      (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.can_direct_message(
        (select auth.uid()),
        ((storage.foldername(name))[1])::uuid
      )
    )
  )
);

create or replace function private.update_my_profile(
  requested_first_name text,
  requested_bio text,
  requested_activity_slugs text[],
  requested_photo_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := trim(requested_first_name);
  normalized_bio text := nullif(trim(requested_bio), '');
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized_name) not between 1 and 60 then
    raise exception 'First name must be between 1 and 60 characters';
  end if;
  if normalized_bio is not null and char_length(normalized_bio) > 500 then
    raise exception 'Bio must be 500 characters or fewer';
  end if;
  if coalesce(cardinality(requested_activity_slugs), 0) = 0 then
    raise exception 'Choose at least one activity';
  end if;
  if (
    select count(distinct activity.slug)
    from public.activity_types activity
    where activity.slug = any(requested_activity_slugs)
      and activity.active
  ) <> cardinality(requested_activity_slugs) then
    raise exception 'One or more activities are invalid';
  end if;
  if requested_photo_path is not null
    and split_part(requested_photo_path, '/', 1) <> caller_id::text then
    raise exception 'Profile photo path must belong to the signed-in member';
  end if;

  update public.profiles
  set
    first_name = normalized_name,
    bio = normalized_bio,
    photo_path = requested_photo_path,
    updated_at = now()
  where user_id = caller_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  delete from public.user_activity_preferences
  where user_id = caller_id;

  insert into public.user_activity_preferences (user_id, activity_type_id)
  select caller_id, activity.id
  from public.activity_types activity
  where activity.slug = any(requested_activity_slugs)
    and activity.active;
end
$$;

create or replace function private.get_participant_profile_photo_path(
  requested_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_direct_message(caller_id, requested_user_id) then
    raise exception 'Participant profile not found';
  end if;

  select profile.photo_path
  into result
  from public.profiles profile
  where profile.user_id = requested_user_id;

  return result;
end
$$;

create or replace function public.update_my_profile(
  requested_first_name text,
  requested_bio text,
  requested_activity_slugs text[],
  requested_photo_path text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_my_profile(
    requested_first_name,
    requested_bio,
    requested_activity_slugs,
    requested_photo_path
  )
$$;

create or replace function public.get_participant_profile_photo_path(
  requested_user_id uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_participant_profile_photo_path(requested_user_id)
$$;

revoke all on function private.update_my_profile(text, text, text[], text)
from public, anon;
revoke all on function private.get_participant_profile_photo_path(uuid)
from public, anon;
grant execute on function private.update_my_profile(text, text, text[], text)
to authenticated;
grant execute on function private.get_participant_profile_photo_path(uuid)
to authenticated;

revoke all on function public.update_my_profile(text, text, text[], text)
from public, anon;
revoke all on function public.get_participant_profile_photo_path(uuid)
from public, anon;
grant execute on function public.update_my_profile(text, text, text[], text)
to authenticated;
grant execute on function public.get_participant_profile_photo_path(uuid)
to authenticated;
