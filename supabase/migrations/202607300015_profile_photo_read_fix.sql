-- Fix profile-photo reads. The original storage policy called
-- private.can_direct_message directly; authenticated Storage requests cannot
-- execute that internal helper. This wrapper exposes only whether the current
-- caller may read one exact, currently referenced profile-photo object.

create or replace function private.can_read_profile_photo(
  requested_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  owner_segment text := split_part(requested_object_name, '/', 1);
  owner_id uuid;
begin
  if caller_id is null then
    return false;
  end if;
  if owner_segment
    !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  owner_id := owner_segment::uuid;
  if owner_id = caller_id then
    return true;
  end if;

  return exists (
    select 1
    from public.profiles profile
    where profile.user_id = owner_id
      and profile.photo_path = requested_object_name
      and private.can_direct_message(caller_id, owner_id)
  );
end
$$;

drop policy if exists "connected members can read profile photos" on storage.objects;
create policy "connected members can read profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and private.can_read_profile_photo(name)
);

revoke all on function private.can_read_profile_photo(text)
from public, anon;
grant execute on function private.can_read_profile_photo(text)
to authenticated;
