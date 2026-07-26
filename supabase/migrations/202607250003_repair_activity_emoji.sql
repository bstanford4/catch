-- Repair activity emoji that may have been copied through Windows PowerShell
-- using its legacy default text encoding. This file is intentionally ASCII-only.

update public.activity_types
set emoji = case slug
  when 'baseball' then U&'\26BE'
  when 'softball' then U&'\+01F94E'
  when 'football' then U&'\+01F3C8'
  when 'frisbee' then U&'\+01F94F'
  when 'lacrosse' then U&'\+01F94D'
  when 'soccer' then U&'\26BD'
  when 'basketball' then U&'\+01F3C0'
  when 'tennis' then U&'\+01F3BE'
  when 'pickleball' then U&'\+01F3D3'
  when 'pong' then U&'\+01F3D3'
  when 'die' then U&'\+01F3B2'
  when 'other' then U&'\2728'
  else emoji
end
where slug in (
  'baseball',
  'softball',
  'football',
  'frisbee',
  'lacrosse',
  'soccer',
  'basketball',
  'tennis',
  'pickleball',
  'pong',
  'die',
  'other'
);
