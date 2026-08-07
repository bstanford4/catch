-- Fix the connected-viewer branch of the shareable equipment photo policy.
-- The previous local variable name collided with equipment_items.owner_id and
-- caused Postgres to reject the policy check as ambiguous. Privacy behavior is
-- otherwise unchanged.

create or replace function private.can_read_shareable_equipment_photo(
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
  equipment_owner_id uuid;
begin
  if caller_id is null then
    return false;
  end if;
  if owner_segment
    !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  equipment_owner_id := owner_segment::uuid;
  if equipment_owner_id = caller_id then
    return true;
  end if;

  return exists (
    select 1
    from public.equipment_photos photo
    join public.equipment_items item on item.id = photo.equipment_item_id
    where photo.storage_path = requested_object_name
      and item.owner_id = equipment_owner_id
      and item.can_share
      and private.can_direct_message(caller_id, equipment_owner_id)
  );
end
$$;

revoke all on function private.can_read_shareable_equipment_photo(text)
from public, anon;
grant execute on function private.can_read_shareable_equipment_photo(text)
to authenticated;

comment on function private.can_read_shareable_equipment_photo(text) is
'Allows owners or connected members to read the exact photo for explicitly shareable equipment.';
