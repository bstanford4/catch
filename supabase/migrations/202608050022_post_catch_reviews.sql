-- One editable post-Catch review flow for planned, impromptu, and retroactive Catches.
-- Ratings remain private raw records. Only the signed-in member's own aggregate
-- scouting report is exposed by this migration.

alter table public.ratings
  add column if not exists traits text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists ratings_subject_catch_mate_idx
on public.ratings (subject_id, aspect, created_at desc)
where subject_type = 'user';

create or replace function private.is_completed_catch_crew_member(
  requested_catch_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catches target
    where target.id = requested_catch_id
      and target.status = 'completed'
      and (
        target.host_id = requested_user_id
        or exists (
          select 1
          from public.catch_participants participant
          where participant.catch_id = target.id
            and participant.user_id = requested_user_id
            and participant.status in ('approved', 'attended')
        )
      )
  );
$$;

revoke all on function private.is_completed_catch_crew_member(uuid, uuid)
from public, anon, authenticated;

create or replace function private.list_post_catch_review(
  requested_catch_id uuid
)
returns table (
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  subject_id uuid,
  subject_name text,
  score smallint,
  would_catch_again boolean,
  traits text[],
  private_note text,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_completed_catch_crew_member(requested_catch_id, caller_id) then
    raise exception 'Post-Catch reviews are available only to the completed Catch crew';
  end if;

  return query
  with crew as (
    select target.host_id as user_id
    from public.catches target
    where target.id = requested_catch_id

    union

    select participant.user_id
    from public.catch_participants participant
    where participant.catch_id = requested_catch_id
      and participant.status in ('approved', 'attended')
  )
  select
    target.id,
    target.title,
    target.starts_at,
    member.user_id,
    private.member_display_name(profile.first_name, profile.last_initial),
    review.score,
    review.would_catch_again,
    coalesce(review.traits, array[]::text[]),
    review.private_note,
    review.updated_at
  from public.catches target
  join crew member on member.user_id <> caller_id
  join public.profiles profile on profile.user_id = member.user_id
  left join public.ratings review
    on review.catch_id = target.id
   and review.rater_id = caller_id
   and review.subject_type = 'user'
   and review.subject_id = member.user_id
   and review.aspect = 'catch_mate'
  where target.id = requested_catch_id
  order by member.user_id;
end;
$$;

create or replace function public.list_post_catch_review(
  requested_catch_id uuid
)
returns table (
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  subject_id uuid,
  subject_name text,
  score smallint,
  would_catch_again boolean,
  traits text[],
  private_note text,
  reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_post_catch_review(requested_catch_id);
$$;

revoke all on function public.list_post_catch_review(uuid) from public, anon;
grant execute on function public.list_post_catch_review(uuid) to authenticated;

create or replace function private.upsert_post_catch_review(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_score smallint,
  requested_would_catch_again boolean,
  requested_traits text[] default '{}',
  requested_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  cleaned_traits text[];
  cleaned_note text := nullif(trim(coalesce(requested_private_note, '')), '');
  review_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_subject_id is null or requested_subject_id = caller_id then
    raise exception 'Choose another confirmed participant';
  end if;
  if requested_score is null or requested_score not between 1 and 5 then
    raise exception 'Overall experience must be between 1 and 5';
  end if;
  if requested_would_catch_again is null then
    raise exception 'Choose whether you would Catch with this person again';
  end if;
  if cleaned_note is not null and char_length(cleaned_note) > 1000 then
    raise exception 'Private note must be 1000 characters or fewer';
  end if;

  select coalesce(array_agg(distinct lower(trim(value)) order by lower(trim(value))), '{}')
  into cleaned_traits
  from unnest(coalesce(requested_traits, '{}')) value
  where trim(value) <> '';

  if exists (
    select 1
    from unnest(cleaned_traits) value
    where value <> all(array[
      'reliable', 'good_sport', 'communicative', 'prepared', 'encouraging'
    ])
  ) then
    raise exception 'One or more selected traits are not supported';
  end if;

  if not private.is_completed_catch_crew_member(requested_catch_id, caller_id)
     or not private.is_completed_catch_crew_member(requested_catch_id, requested_subject_id) then
    raise exception 'Reviews require a completed shared Catch';
  end if;

  insert into public.ratings (
    catch_id, rater_id, subject_type, subject_id, aspect, score,
    would_catch_again, private_note, traits, updated_at
  ) values (
    requested_catch_id, caller_id, 'user', requested_subject_id, 'catch_mate',
    requested_score, requested_would_catch_again, cleaned_note, cleaned_traits, now()
  )
  on conflict (catch_id, rater_id, subject_type, subject_id, aspect)
  do update set
    score = excluded.score,
    would_catch_again = excluded.would_catch_again,
    private_note = excluded.private_note,
    traits = excluded.traits,
    updated_at = now()
  returning id into review_id;

  return review_id;
end;
$$;

create or replace function public.upsert_post_catch_review(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_score smallint,
  requested_would_catch_again boolean,
  requested_traits text[] default '{}',
  requested_private_note text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.upsert_post_catch_review(
    requested_catch_id,
    requested_subject_id,
    requested_score,
    requested_would_catch_again,
    requested_traits,
    requested_private_note
  );
$$;

revoke all on function public.upsert_post_catch_review(uuid, uuid, smallint, boolean, text[], text)
from public, anon;
grant execute on function public.upsert_post_catch_review(uuid, uuid, smallint, boolean, text[], text)
to authenticated;

create or replace function private.list_my_post_catch_review_status()
returns table (
  catch_id uuid,
  eligible_count integer,
  completed_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_catches as (
    select target.id
    from public.catches target
    where target.status = 'completed'
      and (
        target.host_id = auth.uid()
        or exists (
          select 1
          from public.catch_participants membership
          where membership.catch_id = target.id
            and membership.user_id = auth.uid()
            and membership.status in ('approved', 'attended')
        )
      )
  ), crew as (
    select eligible.id as catch_id, target.host_id as user_id
    from eligible_catches eligible
    join public.catches target on target.id = eligible.id

    union

    select eligible.id, participant.user_id
    from eligible_catches eligible
    join public.catch_participants participant on participant.catch_id = eligible.id
    where participant.status in ('approved', 'attended')
  )
  select
    eligible.id,
    count(crew.user_id) filter (where crew.user_id <> auth.uid())::integer,
    count(review.id)::integer
  from eligible_catches eligible
  left join crew on crew.catch_id = eligible.id and crew.user_id <> auth.uid()
  left join public.ratings review
    on review.catch_id = eligible.id
   and review.rater_id = auth.uid()
   and review.subject_type = 'user'
   and review.subject_id = crew.user_id
   and review.aspect = 'catch_mate'
  group by eligible.id;
$$;

create or replace function public.list_my_post_catch_review_status()
returns table (
  catch_id uuid,
  eligible_count integer,
  completed_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_my_post_catch_review_status() $$;

revoke all on function public.list_my_post_catch_review_status() from public, anon;
grant execute on function public.list_my_post_catch_review_status() to authenticated;

create or replace function private.get_my_scouting_report()
returns table (
  completed_catch_count integer,
  rating_count integer,
  average_score numeric,
  reliable_percent integer,
  would_again_percent integer,
  top_traits text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with completed as (
    select count(*)::integer as catch_count
    from public.catches target
    where target.status = 'completed'
      and (
        target.host_id = caller_id
        or exists (
          select 1
          from public.catch_participants membership
          where membership.catch_id = target.id
            and membership.user_id = caller_id
            and membership.status in ('approved', 'attended')
        )
      )
  ), received as (
    select review.*
    from public.ratings review
    join public.catches target on target.id = review.catch_id
    where review.subject_type = 'user'
      and review.subject_id = caller_id
      and review.aspect = 'catch_mate'
      and target.status = 'completed'
  ), trait_counts as (
    select trait, count(*) as trait_count
    from received review
    cross join lateral unnest(review.traits) trait
    group by trait
  )
  select
    completed.catch_count,
    count(received.id)::integer,
    round(avg(received.score), 1),
    case when count(received.id) = 0 then 0 else
      round(100.0 * count(received.id) filter (where 'reliable' = any(received.traits)) / count(received.id))::integer
    end,
    case when count(received.id) filter (where received.would_catch_again is not null) = 0 then 0 else
      round(100.0 * count(received.id) filter (where received.would_catch_again) /
        count(received.id) filter (where received.would_catch_again is not null))::integer
    end,
    array(
      select trait_counts.trait
      from trait_counts
      order by trait_counts.trait_count desc, trait_counts.trait
      limit 3
    )
  from completed
  left join received on true
  group by completed.catch_count;
end;
$$;

create or replace function public.get_my_scouting_report()
returns table (
  completed_catch_count integer,
  rating_count integer,
  average_score numeric,
  reliable_percent integer,
  would_again_percent integer,
  top_traits text[]
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.get_my_scouting_report() $$;

revoke all on function public.get_my_scouting_report() from public, anon;
grant execute on function public.get_my_scouting_report() to authenticated;

comment on function public.list_post_catch_review(uuid) is
'Lists every other confirmed participant in a completed Catch plus the caller''s editable review.';
comment on function public.upsert_post_catch_review(uuid, uuid, smallint, boolean, text[], text) is
'Creates or updates the caller''s private structured review of another confirmed participant.';
comment on function public.get_my_scouting_report() is
'Returns the caller''s own aggregate Catch and post-Catch review statistics.';
