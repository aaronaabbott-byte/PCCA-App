#!/usr/bin/env bash
# Tests for 0005_polls.sql, run against a real Postgres with all five
# migrations applied. Every check runs as the `authenticated` role with a JWT
# claim set, which is how Supabase actually evaluates these policies.
# Running as superuser would bypass RLS and prove nothing.
set -uo pipefail

H=${PGHOST:-/tmp}; P=${PGPORT:-5440}; DB=${PGDATABASE:-pcca}
PASS=0; FAIL=0

# Run SQL as a signed-in app user. $1 = auth uuid, stdin = SQL.
as_user() {
  psql -h "$H" -p "$P" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -tAq \
    -c "set role authenticated;" \
    -c "set request.jwt.claim.sub = '$1';" \
    -f - 2>&1
}

ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m  %s\n     %s\n' "$1" "$2"; }

# expect the SQL to succeed and its output to equal $3
expect_eq() { # name, authid, want, sql
  local got; got=$(printf '%s' "$4" | as_user "$2" | tr -d '[:space:]')
  [[ "$got" == "$3" ]] && ok "$1" || bad "$1" "wanted '$3', got '$got'"
}
# expect the SQL to be rejected BY THE DATABASE, not by the network. A test
# that passes when Postgres is unreachable is worse than no test.
expect_err() { # name, authid, sql
  local got; got=$(printf '%s' "$3" | as_user "$2")
  if grep -qiE 'connection|server closed|terminating|No such file|stack depth' <<<"$got"; then
    bad "$1" "database unreachable or crashed, not a real rejection"
  elif grep -qiE 'denied|violat|authoris|authoriz|ERROR:' <<<"$got"; then
    ok "$1"
  else
    bad "$1" "expected rejection, got: $(tr '\n' ' ' <<<"$got" | cut -c1-120)"
  fi
}

echo
echo "polls: row level security and ballot integrity"
echo

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
psql -h "$H" -p "$P" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
delete from poll_votes; delete from poll_options; delete from polls;
delete from messages; delete from memberships; delete from public.users;
delete from auth.users;

insert into auth.users (email) values
  ('kate@example.com'), ('ben@example.com'), ('dana@example.com'), ('head@example.com');

insert into public.users (auth_user_id, email, first_name, last_name, role, invite_status, accepted_at)
select a.id, a.email,
       initcap(split_part(a.email,'@',1)), 'Test',
       case when a.email = 'head@example.com' then 'admin'::app_role else 'parent'::app_role end,
       'accepted', now()
  from auth.users a;

-- Kate and Ben are Grade 7 parents. Dana is Grade 8. The head is an admin
-- with no membership anywhere, to prove admin access does not depend on it.
insert into memberships (channel_id, user_id, can_post)
select c.id, u.id, true
  from channels c, public.users u
 where c.slug = 'grade-7' and u.email in ('kate@example.com','ben@example.com');

insert into memberships (channel_id, user_id, can_post)
select c.id, u.id, true
  from channels c, public.users u
 where c.slug = 'grade-8' and u.email = 'dana@example.com';
SQL

AUTH() { psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq \
  -c "select id from auth.users where email='$1';" | tr -d '[:space:]'; }
KATE=$(AUTH kate@example.com); BEN=$(AUTH ben@example.com)
DANA=$(AUTH dana@example.com); HEAD=$(AUTH head@example.com)

# Kate starts a named, single-choice poll in Grade 7.
psql -h "$H" -p "$P" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
with m as (
  insert into messages (channel_id, author_id, body)
  select c.id, u.id, 'Which Saturday for the class party?'
    from channels c, public.users u
   where c.slug='grade-7' and u.email='kate@example.com'
  returning id
), p as (
  insert into polls (message_id, question, allow_multiple, anonymous, hide_results_until_voted)
  select id, 'Which Saturday?', false, false, true from m
  returning id
)
insert into poll_options (poll_id, label, sort_order)
select p.id, v.label, v.ord from p,
  (values ('April 11',0), ('April 18',1), ('April 25',2)) as v(label, ord);
SQL
POLL=$(psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq -c "select id from polls;" | tr -d '[:space:]')
OPT1=$(psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq -c "select id from poll_options where label='April 11';" | tr -d '[:space:]')
OPT2=$(psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq -c "select id from poll_options where label='April 18';" | tr -d '[:space:]')

# ---------------------------------------------------------------------------
echo "visibility"
expect_eq "grade 7 parent sees the poll"        "$KATE" "1" "select count(*) from polls;"
expect_eq "the other grade 7 parent sees it"    "$BEN"  "1" "select count(*) from polls;"
expect_eq "grade 8 parent sees nothing"         "$DANA" "0" "select count(*) from polls;"
expect_eq "grade 8 parent sees no options"      "$DANA" "0" "select count(*) from poll_options;"
expect_eq "admin sees it without membership"    "$HEAD" "1" "select count(*) from polls;"

echo
echo "voting"
expect_eq "member votes" "$BEN" "1" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT1',id from public.users where email='ben@example.com' returning 1;"
expect_err "same option twice is rejected" "$BEN" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT1',id from public.users where email='ben@example.com';"
expect_err "second option on a single-choice poll is rejected" "$BEN" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT2',id from public.users where email='ben@example.com';"
expect_err "non-member cannot vote" "$DANA" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT1',id from public.users where email='dana@example.com';"
expect_err "cannot vote as somebody else" "$BEN" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT2',id from public.users where email='kate@example.com';"
expect_eq "withdrawing your own vote works" "$BEN" "1" \
  "delete from poll_votes where poll_id='$POLL' and user_id=(select id from public.users where email='ben@example.com') returning 1;"
expect_eq "and then you can change your mind" "$BEN" "1" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT2',id from public.users where email='ben@example.com' returning 1;"

echo
echo "results"
expect_eq "voter sees counts" "$BEN" "0|1|0" \
  "select string_agg(coalesce(votes::text,'null'), '|' order by label) from poll_results('$POLL');"
expect_eq "non-voter gets the ballot but no counts" "$KATE" "null|null|null" \
  "select string_agg(coalesce(votes::text,'null'), '|' order by label) from poll_results('$POLL');"
expect_err "non-member cannot call poll_results" "$DANA" \
  "select * from poll_results('$POLL');"
expect_eq "admin always sees counts" "$HEAD" "0|1|0" \
  "select string_agg(coalesce(votes::text,'null'), '|' order by label) from poll_results('$POLL');"

echo
echo "ballot integrity"
expect_err "options are frozen once a vote exists" "$KATE" \
  "update poll_options set label='April 12' where id='$OPT1';"
expect_err "anonymity cannot be switched after votes" "$KATE" \
  "update polls set anonymous = true where id='$POLL';"
expect_err "an option from another poll is rejected" "$KATE" \
  "insert into poll_votes (poll_id, option_id, user_id)
     select '$POLL', gen_random_uuid(), id from public.users where email='kate@example.com';"

echo
echo "named vs anonymous"
expect_eq "on a named poll, members see who voted" "$KATE" "1" \
  "select count(*) from poll_votes where poll_id='$POLL';"

# A second, genuinely anonymous poll. Flipping the flag on the first one is
# correctly refused once it has votes, which is the behaviour tested above.
psql -h "$H" -p "$P" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
with m as (
  insert into messages (channel_id, author_id, body)
  select c.id, u.id, 'Anonymous: how is the homework load?'
    from channels c, public.users u
   where c.slug='grade-7' and u.email='kate@example.com'
  returning id
), p as (
  insert into polls (message_id, question, allow_multiple, anonymous, hide_results_until_voted)
  select id, 'Homework load?', false, true, false from m
  returning id
)
insert into poll_options (poll_id, label, sort_order)
select p.id, v.label, v.ord from p,
  (values ('Too much',0), ('About right',1)) as v(label, ord);
SQL
ANON=$(psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq -c "select id from polls where anonymous;" | tr -d '[:space:]')
AOPT=$(psql -h "$H" -p "$P" -U postgres -d "$DB" -tAq -c "select id from poll_options where label='Too much';" | tr -d '[:space:]')
expect_eq "vote on the anonymous poll" "$BEN" "1" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$ANON','$AOPT',id from public.users where email='ben@example.com' returning 1;"
expect_eq "others cannot see who voted" "$KATE" "0" \
  "select count(*) from poll_votes where poll_id='$ANON';"
expect_eq "but you can still see your own" "$BEN" "1" \
  "select count(*) from poll_votes where poll_id='$ANON';"
expect_eq "and the tally still works for everyone" "$KATE" "0|1" \
  "select string_agg(coalesce(votes::text,'null'), '|' order by label) from poll_results('$ANON');"

echo
echo "closing and moderation"
psql -h "$H" -p "$P" -U postgres -d "$DB" -q -c "update polls set closes_at = now() - interval '1 minute' where id='$POLL';" >/dev/null
expect_err "a closed poll rejects new votes" "$KATE" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT1',id from public.users where email='kate@example.com';"
expect_eq "a closed poll shows counts to everyone" "$KATE" "0|1|0" \
  "select string_agg(coalesce(votes::text,'null'), '|' order by label) from poll_results('$POLL');"
psql -h "$H" -p "$P" -U postgres -d "$DB" -q -c "update polls set closes_at = null where id='$POLL';" >/dev/null

# Redaction follows the messages convention: the row survives for the audit
# log and the chat renders it as removed. What must stop is new votes.
psql -h "$H" -p "$P" -U postgres -d "$DB" -q -c "update messages set redacted_at = now();" >/dev/null
expect_err "a redacted poll takes no new votes" "$KATE" \
  "insert into poll_votes (poll_id, option_id, user_id) select '$POLL','$OPT1',id from public.users where email='kate@example.com';"
expect_eq "the votes already cast survive for the audit log" "$HEAD" "1" \
  "select count(*) from poll_votes where poll_id='$POLL';"
expect_eq "admin can still read the poll" "$HEAD" "2" "select count(*) from polls;"

echo
echo "-----------------------------------------"
printf " %d passed, %d failed\n" "$PASS" "$FAIL"
echo "-----------------------------------------"
[[ $FAIL -eq 0 ]]
