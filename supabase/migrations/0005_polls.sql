-- Polls in the grade-channel chats.
--
-- A poll is a message. It is not a new kind of object with its own
-- permissions, its own feed, or its own notification rules. Hanging it off
-- messages means it inherits, with no new code:
--
--   who can see it        messages_read, via channel membership
--   who can create one    messages_insert, via can_post
--   where it appears      in the chat, in order, because it is a message
--   how it gets killed    messages.redacted_at, like any other message
--   notifications         the channel's existing preferences
--
-- Same reasoning that put events on channels in 0004_events.sql.
--
-- Defaults chosen here, changeable per poll by whoever creates it:
--   named votes        people are talking to their own grade's parents
--   single choice      the common case is "which Saturday"
--   hide results       a running tally visibly biases later voters
--
-- Not covered on purpose: polls on feed posts. The division feeds are
-- announcement surfaces and nobody asked for it. The same three tables would
-- extend there later by making the parent reference nullable.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table polls (
  id           uuid primary key default gen_random_uuid(),

  -- one poll per message. the message carries channel, author and timestamp,
  -- so none of those are repeated here.
  message_id   uuid not null unique references messages (id) on delete cascade,

  question     text not null,
  allow_multiple boolean not null default false,
  anonymous    boolean not null default false,

  -- when true, a voter sees counts only after voting, or after close
  hide_results_until_voted boolean not null default true,

  -- null means open until someone closes it
  closes_at    timestamptz,

  created_at   timestamptz not null default now()
);

create table poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references polls (id) on delete cascade,
  label      text not null,
  sort_order int not null default 0,

  -- lets poll_votes prove, in the database, that an option belongs to the
  -- poll being voted in
  unique (poll_id, id)
);

create index poll_options_poll_idx on poll_options (poll_id, sort_order);

create table poll_votes (
  poll_id    uuid not null,
  option_id  uuid not null,
  user_id    uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- one row per person per option makes double voting impossible here rather
  -- than in application code
  primary key (poll_id, option_id, user_id),

  -- and this makes it impossible to vote for an option from another poll
  foreign key (poll_id, option_id)
    references poll_options (poll_id, id) on delete cascade
);

create index poll_votes_option_idx on poll_votes (option_id);
create index poll_votes_user_idx on poll_votes (poll_id, user_id);

-- ---------------------------------------------------------------------------
-- Integrity that RLS cannot express
-- ---------------------------------------------------------------------------

-- Single-choice polls, and closed polls.
create or replace function poll_votes_guard()
returns trigger
language plpgsql
as $$
declare
  v_multiple boolean;
  v_closes   timestamptz;
  v_redacted timestamptz;
begin
  select p.allow_multiple, p.closes_at, m.redacted_at
    into v_multiple, v_closes, v_redacted
    from polls p join messages m on m.id = p.message_id
   where p.id = new.poll_id;

  if v_redacted is not null then
    raise exception 'poll % was removed by a moderator', new.poll_id
      using errcode = 'check_violation';
  end if;

  if v_closes is not null and v_closes <= now() then
    raise exception 'poll % is closed', new.poll_id
      using errcode = 'check_violation';
  end if;

  if not v_multiple and exists (
    select 1 from poll_votes
     where poll_id = new.poll_id and user_id = new.user_id
  ) then
    raise exception 'poll % allows one choice; withdraw the existing vote first',
      new.poll_id using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger poll_votes_guard_ins
  before insert on poll_votes
  for each row execute function poll_votes_guard();

-- Once a vote exists the ballot is frozen. Editing option labels under people
-- who have already voted silently changes what they said.
create or replace function poll_options_frozen()
returns trigger
language plpgsql
as $$
declare
  v_poll uuid := coalesce(new.poll_id, old.poll_id);
begin
  if exists (select 1 from poll_votes where poll_id = v_poll) then
    raise exception 'poll % already has votes; its options cannot change', v_poll
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger poll_options_frozen_iud
  before insert or update or delete on poll_options
  for each row execute function poll_options_frozen();

-- Same for the two settings that would retroactively change what a vote meant.
create or replace function polls_settings_frozen()
returns trigger
language plpgsql
as $$
begin
  if (new.anonymous is distinct from old.anonymous
      or new.allow_multiple is distinct from old.allow_multiple)
     and exists (select 1 from poll_votes where poll_id = old.id) then
    raise exception 'poll % already has votes; anonymity and choice mode are fixed', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger polls_settings_frozen_upd
  before update on polls
  for each row execute function polls_settings_frozen();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table polls        enable row level security;
alter table poll_options enable row level security;
alter table poll_votes   enable row level security;

-- Can the current user see the message this poll hangs off?
--
-- security definer is load bearing, not a convenience. This function reads
-- polls, and the policy on polls calls this function. Without it the two
-- recurse until the stack runs out. It is the same pattern as
-- current_app_user_id() and is_admin() in 0001, and it is safe for the same
-- reason: it takes no caller-supplied identity and returns one boolean about
-- the current user, so it cannot be used to read anyone else's rows.
-- Redaction is deliberately NOT checked here. messages_read does not filter
-- on redacted_at either: the row has to survive so the administrator audit
-- log works without a second system, and the chat renders it as removed. A
-- poll follows the same rule, and the thing that actually matters, that a
-- redacted poll cannot collect new votes, is enforced in poll_votes_guard
-- alongside the closed-poll check.
create or replace function can_see_poll(p_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from polls p
      join messages m    on m.id = p.message_id
      join memberships mb on mb.channel_id = m.channel_id
     where p.id = p_poll_id
       and mb.user_id = current_app_user_id()
  );
$$;

-- polls
create policy polls_read on polls
  for select using (can_see_poll(id));

create policy polls_author_manage on polls
  for all using (
    exists (
      select 1 from messages m
       where m.id = polls.message_id
         and m.author_id = current_app_user_id()
    )
  ) with check (
    exists (
      select 1 from messages m
       where m.id = polls.message_id
         and m.author_id = current_app_user_id()
    )
  );

create policy polls_admin_all on polls
  for all using (is_admin()) with check (is_admin());

-- poll_options
create policy poll_options_read on poll_options
  for select using (can_see_poll(poll_id));

create policy poll_options_author_manage on poll_options
  for all using (
    exists (
      select 1 from polls p join messages m on m.id = p.message_id
       where p.id = poll_options.poll_id
         and m.author_id = current_app_user_id()
    )
  ) with check (
    exists (
      select 1 from polls p join messages m on m.id = p.message_id
       where p.id = poll_options.poll_id
         and m.author_id = current_app_user_id()
    )
  );

create policy poll_options_admin_all on poll_options
  for all using (is_admin()) with check (is_admin());

-- poll_votes
--
-- Your own vote is always yours to read. Everyone else's is readable only on
-- a named poll. On an anonymous poll nobody can read the rows at all, which
-- is what makes poll_results() necessary.
create policy poll_votes_read on poll_votes
  for select using (
    user_id = current_app_user_id()
    or (
      can_see_poll(poll_id)
      and not exists (
        select 1 from polls p where p.id = poll_votes.poll_id and p.anonymous
      )
    )
  );

-- Membership is enough to vote. can_post governs who may start a poll, by
-- governing who may post the message; a read-only member should still get a
-- say in their own grade's poll.
create policy poll_votes_insert on poll_votes
  for insert with check (
    user_id = current_app_user_id()
    and can_see_poll(poll_id)
  );

-- Withdrawing your own vote is how you change your mind.
create policy poll_votes_delete on poll_votes
  for delete using (
    user_id = current_app_user_id()
    and can_see_poll(poll_id)
  );

create policy poll_votes_admin_all on poll_votes
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Tallies
--
-- On an anonymous poll the vote rows are unreadable by design, so counts
-- cannot come from a plain select. This runs as the definer to read them,
-- which means it has to do its own authorization. It does, below, and it
-- also enforces hide_results_until_voted so the rule cannot be skipped by
-- calling the API directly.
--
-- votes is null, rather than 0, when the caller is not yet entitled to see
-- counts. The option list still comes back so the ballot can render.
-- ---------------------------------------------------------------------------

create or replace function poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, votes bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin  boolean := is_admin();
  v_hide   boolean;
  v_closes timestamptz;
  v_voted  boolean;
  v_show   boolean;
begin
  if not v_admin and not can_see_poll(p_poll_id) then
    raise exception 'not authorised to read poll %', p_poll_id
      using errcode = 'insufficient_privilege';
  end if;

  select p.hide_results_until_voted, p.closes_at
    into v_hide, v_closes
    from polls p where p.id = p_poll_id;

  if not found then
    raise exception 'no such poll %', p_poll_id;
  end if;

  v_voted := exists (
    select 1 from poll_votes v
     where v.poll_id = p_poll_id and v.user_id = current_app_user_id()
  );

  v_show := v_admin
            or not v_hide
            or v_voted
            or (v_closes is not null and v_closes <= now());

  return query
    select o.id,
           o.label,
           case when v_show then count(v.user_id) else null end
      from poll_options o
      left join poll_votes v on v.option_id = o.id
     where o.poll_id = p_poll_id
     group by o.id, o.label, o.sort_order
     order by o.sort_order, o.label;
end;
$$;

revoke all on function poll_results(uuid) from public;
grant execute on function poll_results(uuid) to authenticated;
