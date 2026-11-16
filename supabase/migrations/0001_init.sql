-- Providence Academy Community App
-- Phase 1 schema.
--
-- Design note: channels, posts and messages are ONE shape from the start.
-- A division feed is a channel where only admins may post. A grade group chat
-- is a channel where everyone may. An announcement is a post with a priority.
-- Keeping these unified is what stops the app doubling in size at Phase 3.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type app_role as enum ('parent', 'teacher', 'division_lead', 'admin', 'student');
create type division as enum ('all_campus', 'grammar', 'logic', 'rhetoric', 'fine_arts', 'staff');
create type channel_kind as enum ('feed', 'group', 'direct');
create type post_priority as enum ('normal', 'announcement', 'emergency');
create type invite_status as enum ('not_sent', 'sent', 'accepted', 'bounced');

-- ---------------------------------------------------------------------------
-- users
-- Mirrors auth.users. The app never creates rows here from a public signup:
-- an admin imports a roster, which is what makes the app invite-only.
-- ---------------------------------------------------------------------------

create table users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  email         text not null unique,
  first_name    text not null default '',
  last_name     text not null default '',
  role          app_role not null default 'parent',
  title         text,
  department    text,
  staff_division division,
  invite_status invite_status not null default 'not_sent',
  invited_at    timestamptz,
  accepted_at   timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index users_role_idx on users (role);
create index users_invite_status_idx on users (invite_status);

-- ---------------------------------------------------------------------------
-- families and students
-- A family groups the adults who share students. Students carry the division,
-- which is what drives every feed a parent sees.
-- ---------------------------------------------------------------------------

create table families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table family_members (
  family_id uuid not null references families (id) on delete cascade,
  user_id   uuid not null references users (id) on delete cascade,
  primary key (family_id, user_id)
);

create table students (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  first_name text not null,
  last_name  text not null,
  grade      text not null,           -- 'K', '1' .. '12'
  division   division not null,
  created_at timestamptz not null default now()
);

create index students_family_idx on students (family_id);
create index students_division_idx on students (division);

-- ---------------------------------------------------------------------------
-- channels and memberships
-- ---------------------------------------------------------------------------

create table channels (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  kind          channel_kind not null default 'feed',
  division      division not null default 'all_campus',
  grade         text,                  -- set for grade-level channels
  description   text,
  -- when true only admins and division leads may post; the school-wide feed
  -- and every division feed use this.
  restricted_posting boolean not null default true,
  -- auto-membership: parents are joined to this channel when a student of
  -- theirs matches the division and (if set) the grade.
  auto_join     boolean not null default true,
  sort_order    int not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table memberships (
  channel_id uuid not null references channels (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  can_post   boolean not null default false,
  -- per-channel notification preference, so families are not overwhelmed
  notify     boolean not null default true,
  muted_until timestamptz,
  joined_at  timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index memberships_user_idx on memberships (user_id);

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------

create table posts (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references channels (id) on delete cascade,
  author_id    uuid not null references users (id) on delete restrict,
  title        text not null,
  body         text not null default '',
  hero_image_url text,
  priority     post_priority not null default 'normal',
  published_at timestamptz,
  pinned_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index posts_channel_published_idx on posts (channel_id, published_at desc);

-- ---------------------------------------------------------------------------
-- messages
-- Every message is written with an author and timestamp and is never hard
-- deleted, which is what makes the administrator audit log possible without
-- a second system.
-- ---------------------------------------------------------------------------

create table messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels (id) on delete cascade,
  author_id  uuid not null references users (id) on delete restrict,
  body       text not null,
  redacted_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_channel_idx on messages (channel_id, created_at desc);

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------

create table resources (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  description text,
  url        text,
  file_path  text,                    -- Supabase Storage path when uploaded
  category   text not null default 'General',
  division   division not null default 'all_campus',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- push subscriptions
-- One row per installed device. A family with two phones has two rows.
-- ---------------------------------------------------------------------------

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- import runs
-- Keeps a record of every roster upload so a bad import can be understood
-- after the fact.
-- ---------------------------------------------------------------------------

create table import_runs (
  id            uuid primary key default gen_random_uuid(),
  performed_by  uuid references users (id) on delete set null,
  filename      text,
  rows_total    int not null default 0,
  users_created int not null default 0,
  users_updated int not null default 0,
  students_created int not null default 0,
  errors        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- The app_user id for the current request. security definer so policies can
-- call it without recursing through users' own RLS.
create or replace function current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid()
$$;

create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where auth_user_id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from users where auth_user_id = auth.uid()) = 'admin', false)
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- Permissions live here, not only in the interface. A bug in a React page
-- cannot leak another division's posts.
-- ---------------------------------------------------------------------------

alter table users              enable row level security;
alter table families           enable row level security;
alter table family_members     enable row level security;
alter table students           enable row level security;
alter table channels           enable row level security;
alter table memberships        enable row level security;
alter table posts              enable row level security;
alter table messages           enable row level security;
alter table resources          enable row level security;
alter table push_subscriptions enable row level security;
alter table import_runs        enable row level security;

-- users: everyone signed in can read the directory; only admins write.
create policy users_read on users
  for select using (auth.uid() is not null);
create policy users_self_update on users
  for update using (auth_user_id = auth.uid());
create policy users_admin_all on users
  for all using (is_admin()) with check (is_admin());

-- families and students: your own, or admin.
create policy families_read on families
  for select using (
    is_admin() or exists (
      select 1 from family_members fm
      where fm.family_id = families.id and fm.user_id = current_app_user_id()
    )
  );
create policy families_admin_all on families
  for all using (is_admin()) with check (is_admin());

create policy family_members_read on family_members
  for select using (is_admin() or user_id = current_app_user_id());
create policy family_members_admin_all on family_members
  for all using (is_admin()) with check (is_admin());

create policy students_read on students
  for select using (
    is_admin() or exists (
      select 1 from family_members fm
      where fm.family_id = students.family_id and fm.user_id = current_app_user_id()
    )
  );
create policy students_admin_all on students
  for all using (is_admin()) with check (is_admin());

-- channels: readable by any signed-in user (so they can browse and join
-- optional channels); writable by admins.
create policy channels_read on channels
  for select using (auth.uid() is not null and not archived);
create policy channels_admin_all on channels
  for all using (is_admin()) with check (is_admin());

-- memberships: your own rows, plus admin.
create policy memberships_read on memberships
  for select using (is_admin() or user_id = current_app_user_id());
create policy memberships_self_update on memberships
  for update using (user_id = current_app_user_id());
create policy memberships_admin_all on memberships
  for all using (is_admin()) with check (is_admin());

-- posts: readable only in channels you belong to. This is the policy that
-- keeps a Grammar family from seeing Logic posts.
create policy posts_read on posts
  for select using (
    published_at is not null
    and exists (
      select 1 from memberships m
      where m.channel_id = posts.channel_id and m.user_id = current_app_user_id()
    )
  );
create policy posts_author_manage on posts
  for all using (author_id = current_app_user_id())
  with check (
    author_id = current_app_user_id()
    and exists (
      select 1 from memberships m
      where m.channel_id = posts.channel_id
        and m.user_id = current_app_user_id()
        and m.can_post
    )
  );
create policy posts_admin_all on posts
  for all using (is_admin()) with check (is_admin());

-- messages: same membership rule; admins can read everything, which is the
-- audit log the handbook question turns on.
create policy messages_read on messages
  for select using (
    exists (
      select 1 from memberships m
      where m.channel_id = messages.channel_id and m.user_id = current_app_user_id()
    )
  );
create policy messages_insert on messages
  for insert with check (
    author_id = current_app_user_id()
    and exists (
      select 1 from memberships m
      where m.channel_id = messages.channel_id
        and m.user_id = current_app_user_id()
        and m.can_post
    )
  );
create policy messages_admin_all on messages
  for all using (is_admin()) with check (is_admin());

-- resources: readable by all signed-in users; admin writes.
create policy resources_read on resources
  for select using (auth.uid() is not null);
create policy resources_admin_all on resources
  for all using (is_admin()) with check (is_admin());

-- push subscriptions: strictly your own.
create policy push_self on push_subscriptions
  for all using (user_id = current_app_user_id())
  with check (user_id = current_app_user_id());
create policy push_admin_read on push_subscriptions
  for select using (is_admin());

-- import runs: admin only.
create policy import_runs_admin on import_runs
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Auto-membership
-- When a student is added, join every adult in that family to the channels
-- that match the student's division and grade. This is what makes the feed
-- personalize itself without anyone picking channels by hand.
-- ---------------------------------------------------------------------------

create or replace function sync_family_channel_memberships(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into memberships (channel_id, user_id, can_post)
  select c.id, fm.user_id, not c.restricted_posting
  from family_members fm
  join channels c on c.auto_join and not c.archived and (
        c.division = 'all_campus'
     or exists (
          select 1 from students s
          where s.family_id = p_family_id
            and s.division = c.division
            and (c.grade is null or c.grade = s.grade)
        )
  )
  where fm.family_id = p_family_id
    and c.division <> 'staff'
  on conflict (channel_id, user_id) do nothing;
end;
$$;

create or replace function trg_sync_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sync_family_channel_memberships(
    coalesce(new.family_id, old.family_id)
  );
  return new;
end;
$$;

create trigger students_sync_memberships
  after insert or update on students
  for each row execute function trg_sync_memberships();

create trigger family_members_sync_memberships
  after insert on family_members
  for each row execute function trg_sync_memberships();

-- Staff are joined to staff channels by role.
create or replace function sync_staff_memberships(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  select role into v_role from users where id = p_user_id;
  if v_role in ('teacher', 'division_lead', 'admin') then
    insert into memberships (channel_id, user_id, can_post)
    select c.id, p_user_id, true
    from channels c
    where c.division = 'staff' and c.auto_join and not c.archived
    on conflict (channel_id, user_id) do nothing;
  end if;

  -- division leads and admins may post to the feeds they oversee
  if v_role = 'admin' then
    update memberships set can_post = true where user_id = p_user_id;
  end if;
end;
$$;
