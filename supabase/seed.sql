insert into public.activity_types (slug, name, emoji, sort_order) values
  ('baseball', 'Baseball', U&'\26BE', 10),
  ('softball', 'Softball', U&'\+01F94E', 20),
  ('football', 'Football', U&'\+01F3C8', 30),
  ('frisbee', 'Frisbee', U&'\+01F94F', 40),
  ('lacrosse', 'Lacrosse', U&'\+01F94D', 50),
  ('soccer', 'Soccer', U&'\26BD', 60),
  ('basketball', 'Basketball', U&'\+01F3C0', 70),
  ('tennis', 'Tennis', U&'\+01F3BE', 80),
  ('pickleball', 'Pickleball', U&'\+01F3D3', 90),
  ('pong', 'Pong', U&'\+01F3D3', 100),
  ('die', 'Die', U&'\+01F3B2', 110),
  ('other', 'Other', U&'\2728', 120)
on conflict (slug) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order;

insert into public.activity_subtypes (activity_type_id, slug, name)
select id, subtype.slug, subtype.name
from public.activity_types
cross join lateral (
  values
    ('casual-catch', 'Casual catch'),
    ('long-toss', 'Long toss'),
    ('fielding-practice', 'Fielding practice')
) as subtype(slug, name)
where activity_types.slug in ('baseball', 'softball')
on conflict (activity_type_id, slug) do nothing;

insert into public.activity_subtypes (activity_type_id, slug, name)
select id, subtype.slug, subtype.name
from public.activity_types
cross join lateral (
  values
    ('casual-toss', 'Casual toss'),
    ('routes', 'Routes'),
    ('kicking-practice', 'Kicking practice')
) as subtype(slug, name)
where activity_types.slug = 'football'
on conflict (activity_type_id, slug) do nothing;

insert into public.venues (name, area_label, public_location, address_display, is_public)
values
  (
    'Embrey Mill Park',
    'North Stafford',
    st_setsrid(st_makepoint(-77.414, 38.467), 4326)::geography,
    'North Stafford public park',
    true
  ),
  (
    'Smith Lake Field',
    'Stafford',
    st_setsrid(st_makepoint(-77.43, 38.492), 4326)::geography,
    'Stafford public recreation area',
    true
  ),
  (
    'Willowmere Courts',
    'Garrisonville',
    st_setsrid(st_makepoint(-77.444, 38.472), 4326)::geography,
    'Fictional public court complex',
    true
  )
on conflict do nothing;
