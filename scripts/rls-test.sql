-- Verifies that row-level security actually isolates divisions.
--
-- Runs the real migrations against a local Postgres with a minimal stub of
-- the Supabase auth schema, then queries as three different families and
-- asserts each sees exactly the posts they should.
--
--   psql -f scripts/rls-test.sql

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Stub the parts of Supabase the migrations depend on.
-- ---------------------------------------------------------------------------

create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  email text
);

-- auth.uid() reads the request-local setting the real Supabase sets from
-- the JWT. Tests set it with set_config().
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- The app role the policies run as. Roles are cluster-wide, so re-running
-- this script against a fresh database must not fail on an existing role.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end;
$$;

\ir ../supabase/migrations/0001_init.sql
\ir ../supabase/migrations/0002_seed_channels.sql
\ir ../supabase/migrations/0004_events.sql

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: three families, one per division, plus an admin author.
-- ---------------------------------------------------------------------------

\set QUIET off
\echo ''
\echo '=== Setting up fixtures ==='
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'grammar.parent@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'logic.parent@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'both.parent@test');

insert into users (id, auth_user_id, email, first_name, last_name, role) values
  ('11111111-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'admin@test', 'Ada', 'Admin', 'admin'),
  ('11111111-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'grammar.parent@test', 'Gail', 'Grammar', 'parent'),
  ('11111111-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 'logic.parent@test', 'Leo', 'Logic', 'parent'),
  ('11111111-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 'both.parent@test', 'Bea', 'Both', 'parent');

-- Grammar-only family
insert into families (id, name) values ('22222222-0000-0000-0000-0000000000b1', 'Grammar Family');
insert into family_members values ('22222222-0000-0000-0000-0000000000b1', '11111111-0000-0000-0000-0000000000b1');
insert into students (family_id, first_name, last_name, grade, division)
  values ('22222222-0000-0000-0000-0000000000b1', 'Gus', 'Grammar', '2', 'grammar');

-- Logic-only family
insert into families (id, name) values ('22222222-0000-0000-0000-0000000000c1', 'Logic Family');
insert into family_members values ('22222222-0000-0000-0000-0000000000c1', '11111111-0000-0000-0000-0000000000c1');
insert into students (family_id, first_name, last_name, grade, division)
  values ('22222222-0000-0000-0000-0000000000c1', 'Lena', 'Logic', '7', 'logic');

-- A family with a child in Grammar AND one in Rhetoric, which is the case
-- the personalized feed exists for.
insert into families (id, name) values ('22222222-0000-0000-0000-0000000000d1', 'Both Family');
insert into family_members values ('22222222-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1');
insert into students (family_id, first_name, last_name, grade, division) values
  ('22222222-0000-0000-0000-0000000000d1', 'Bram', 'Both', '3', 'grammar'),
  ('22222222-0000-0000-0000-0000000000d1', 'Bella', 'Both', '11', 'rhetoric');

-- One published post per feed.
insert into posts (channel_id, author_id, title, body, published_at)
select c.id, '11111111-0000-0000-0000-0000000000a1', c.name || ' post', 'body', now()
from channels c
where c.slug in ('all-campus', 'grammar', 'logic', 'rhetoric', 'fine-arts', 'staff');

-- An unpublished draft. Nobody should ever see it.
insert into posts (channel_id, author_id, title, body, published_at)
select c.id, '11111111-0000-0000-0000-0000000000a1', 'DRAFT grammar', 'body', null
from channels c where c.slug = 'grammar';

-- One event per feed, so the calendar can be checked the same way.
insert into events (channel_id, created_by, title, starts_at)
select c.id, '11111111-0000-0000-0000-0000000000a1', c.name || ' event',
       now() + interval '7 days'
from channels c
where c.slug in ('all-campus', 'grammar', 'logic', 'rhetoric', 'fine-arts', 'staff');

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------

create or replace function assert_titles(
  p_auth uuid,
  p_label text,
  p_expected text[]
) returns void
language plpgsql
as $$
declare
  got text[];
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, true);
  set local role authenticated;

  select coalesce(array_agg(title order by title), '{}') into got from posts;

  set local role postgres;

  if got = p_expected then
    raise notice 'PASS  %  sees: %', rpad(p_label, 22), array_to_string(got, ', ');
  else
    raise exception E'FAIL  %\n  expected: %\n  actual:   %',
      p_label, array_to_string(p_expected, ', '), array_to_string(got, ', ');
  end if;
end;
$$;

\set QUIET off
set client_min_messages = notice;
\echo ''
\echo '=== Post visibility by family ==='

do $$
begin
  perform assert_titles(
    '00000000-0000-0000-0000-0000000000b1',
    'Grammar-only family',
    array['All-Campus post', 'Grammar post']
  );

  perform assert_titles(
    '00000000-0000-0000-0000-0000000000c1',
    'Logic-only family',
    array['All-Campus post', 'Logic post']
  );

  perform assert_titles(
    '00000000-0000-0000-0000-0000000000d1',
    'Grammar + Rhetoric family',
    array['All-Campus post', 'Grammar post', 'Rhetoric post']
  );

  perform assert_titles(
    '00000000-0000-0000-0000-0000000000a1',
    'Administrator',
    array['All-Campus post', 'DRAFT grammar', 'Fine Arts post', 'Grammar post',
          'Logic post', 'Rhetoric post', 'Staff post']
  );
end;
$$;

\echo ''
\echo '=== Other guarantees ==='

do $$
declare
  n int;
  ok boolean;
begin
  -- A parent must not be able to post to a restricted feed.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  begin
    insert into posts (channel_id, author_id, title, published_at)
    select id, '11111111-0000-0000-0000-0000000000b1', 'Parent hijack', now()
    from channels where slug = 'grammar';
    ok := false;
  exception when insufficient_privilege or check_violation then
    ok := true;
  end;
  set local role postgres;
  if ok then
    raise notice 'PASS  %  blocked from posting to a restricted feed', rpad('Parent', 22);
  else
    raise exception 'FAIL  a parent was able to post to the Grammar feed';
  end if;

  -- A parent must not see another family's students.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  select count(*) into n from students;
  set local role postgres;
  if n = 1 then
    raise notice 'PASS  %  sees only their own student (%)', rpad('Grammar-only family', 22), n;
  else
    raise exception 'FAIL  a parent saw % student rows, expected 1', n;
  end if;

  -- Unpublished drafts are invisible to families.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  set local role authenticated;
  select count(*) into n from posts where title like 'DRAFT%';
  set local role postgres;
  if n = 0 then
    raise notice 'PASS  %  cannot see unpublished drafts', rpad('Any family', 22);
  else
    raise exception 'FAIL  a family saw % draft posts', n;
  end if;

  -- Auto-membership: the two-division family is in both grade channels.
  select count(*) into n
  from memberships m
  join channels c on c.id = m.channel_id
  where m.user_id = '11111111-0000-0000-0000-0000000000d1'
    and c.grade in ('3', '11');
  if n = 2 then
    raise notice 'PASS  %  auto-joined both grade channels', rpad('Grammar + Rhetoric', 22);
  else
    raise exception 'FAIL  expected 2 grade channels, got %', n;
  end if;

  -- And not in a grade channel for a grade they have no child in.
  select count(*) into n
  from memberships m
  join channels c on c.id = m.channel_id
  where m.user_id = '11111111-0000-0000-0000-0000000000d1'
    and c.grade = '7';
  if n = 0 then
    raise notice 'PASS  %  not joined to unrelated grades', rpad('Grammar + Rhetoric', 22);
  else
    raise exception 'FAIL  family joined to grade 7 channel it has no child in';
  end if;

  -- Every division has its own feed channel, and every grade K-12 has its
  -- own channel. Regression guard: an earlier build had these in the
  -- database but filtered out of every navigation, which made them
  -- unreachable without anything failing.
  select count(*) into n
  from channels
  where kind = 'feed' and division in ('grammar', 'logic', 'rhetoric');
  if n = 3 then
    raise notice 'PASS  %  Grammar, Logic and Rhetoric each have a feed', rpad('Structure', 22);
  else
    raise exception 'FAIL  expected 3 division feeds, found %', n;
  end if;

  select count(*) into n from channels where grade is not null;
  if n = 13 then
    raise notice 'PASS  %  all 13 grades K-12 have their own channel', rpad('Structure', 22);
  else
    raise exception 'FAIL  expected 13 grade channels, found %', n;
  end if;

  -- A parent CAN post in their own grade channel (it is conversational),
  -- which is what distinguishes it from a division feed.
  select count(*) into n
  from memberships m
  join channels c on c.id = m.channel_id
  where m.user_id = '11111111-0000-0000-0000-0000000000b1'
    and c.grade = '2'
    and m.can_post;
  if n = 1 then
    raise notice 'PASS  %  can post in their own grade channel', rpad('Grammar-only family', 22);
  else
    raise exception 'FAIL  parent cannot post in their own grade channel';
  end if;
end;
$$;

\echo ''
\echo '=== Calendar visibility ==='

create or replace function assert_events(
  p_auth uuid,
  p_label text,
  p_expected text[]
) returns void
language plpgsql
as $$
declare
  got text[];
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, true);
  set local role authenticated;

  select coalesce(array_agg(title order by title), '{}') into got from events;

  set local role postgres;

  if got = p_expected then
    raise notice 'PASS  %  sees: %', rpad(p_label, 22), array_to_string(got, ', ');
  else
    raise exception E'FAIL  %\n  expected: %\n  actual:   %',
      p_label, array_to_string(p_expected, ', '), array_to_string(got, ', ');
  end if;
end;
$$;

do $$
declare
  ok boolean;
begin
  -- The calendar inherits the feed's isolation because events hang off
  -- channels. If this ever diverges from the post assertions above, the two
  -- permission systems have drifted apart, which is the thing that design
  -- exists to prevent.
  perform assert_events(
    '00000000-0000-0000-0000-0000000000b1',
    'Grammar-only family',
    array['All-Campus event', 'Grammar event']
  );

  perform assert_events(
    '00000000-0000-0000-0000-0000000000d1',
    'Grammar + Rhetoric fam',
    array['All-Campus event', 'Grammar event', 'Rhetoric event']
  );

  -- A parent must not be able to schedule on a division feed.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  begin
    insert into events (channel_id, created_by, title, starts_at)
    select id, '11111111-0000-0000-0000-0000000000b1', 'Parent event', now()
    from channels where slug = 'grammar';
    ok := false;
  exception when insufficient_privilege or check_violation then
    ok := true;
  end;
  set local role postgres;
  if ok then
    raise notice 'PASS  %  blocked from scheduling on a division feed', rpad('Parent', 22);
  else
    raise exception 'FAIL  a parent scheduled an event on the Grammar feed';
  end if;
end;
$$;

\echo ''
\echo '=== Channel structure a family can actually reach ==='

do $$
declare
  rec record;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  set local role authenticated;

  for rec in
    select c.name, c.kind, m.can_post
    from memberships m
    join channels c on c.id = m.channel_id
    where m.user_id = '11111111-0000-0000-0000-0000000000d1'
    order by c.sort_order
  loop
    raise notice '      %  %',
      rpad(rec.name, 24),
      case when rec.kind = 'feed' then 'announcements' else
        case when rec.can_post then 'can post' else 'read only' end end;
  end loop;

  set local role postgres;
end;
$$;

\echo ''
\echo 'All assertions passed.'
\echo ''
