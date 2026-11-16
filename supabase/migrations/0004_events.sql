-- School events calendar.
--
-- An event belongs to a channel. That single decision gives the calendar
-- everything the feed already has: a Grammar family sees Grammar events and
-- not Logic ones, notification preferences already exist per channel, and
-- there is no second permission system to keep in step with the first.
--
-- Athletics is not here. It has its own app and its own schedule.

create type event_category as enum (
  'academic',     -- exams, conferences, report cards
  'arts',         -- concerts, plays, recitals
  'community',    -- fundraisers, open houses, service days
  'schedule',     -- early dismissal, no school, late start
  'spiritual',    -- chapel, prayer services
  'other'
);

create table events (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references channels (id) on delete cascade,
  created_by   uuid references users (id) on delete set null,

  title        text not null,
  description  text not null default '',
  location     text,
  category     event_category not null default 'other',

  -- starts_at is the source of truth for ordering. all_day events still
  -- carry a timestamp at local midnight; the flag decides whether a time is
  -- shown. time_tbd covers "Girls Conference · TBD", which is common enough
  -- on a school calendar that leaving it to a null would break ordering.
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  time_tbd     boolean not null default false,

  cancelled    boolean not null default false,
  -- set once the day-before reminder has gone out, so a re-run of the
  -- reminder job cannot notify the same families twice
  reminded_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index events_starts_at_idx on events (starts_at);
create index events_channel_starts_idx on events (channel_id, starts_at);

-- ---------------------------------------------------------------------------
-- Calendar subscription tokens
--
-- A family can subscribe to their own events from the iPhone or Google
-- calendar app. The token is the credential in that URL, so it is random,
-- per-user, and revocable without touching the account.
-- ---------------------------------------------------------------------------

alter table users
  add column calendar_token uuid not null default gen_random_uuid();

create unique index users_calendar_token_idx on users (calendar_token);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table events enable row level security;

-- Same membership rule as posts. This is the whole point of hanging events
-- off channels.
create policy events_read on events
  for select using (
    exists (
      select 1 from memberships m
      where m.channel_id = events.channel_id
        and m.user_id = current_app_user_id()
    )
  );

create policy events_author_manage on events
  for all using (created_by = current_app_user_id())
  with check (
    created_by = current_app_user_id()
    and exists (
      select 1 from memberships m
      where m.channel_id = events.channel_id
        and m.user_id = current_app_user_id()
        and m.can_post
    )
  );

create policy events_admin_all on events
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on events
  for each row execute function touch_updated_at();
