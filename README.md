# Providence Academy Community App

Phase 1 foundation. Roster import, invite-only magic-link sign-in, and the
install walkthrough that notifications depend on.

---

## What works right now

| Area | State |
| --- | --- |
| Database schema and row-level security | Complete, tested (see Testing below) |
| Channel structure (All-Campus, three divisions, Fine Arts, Staff, K-12 grades) | Seeded |
| Magic-link sign-in, invite-only | Working |
| Roster CSV import with column mapping and preview | Working |
| Invitations, bulk and resend | Working |
| Personalized news feed and per-channel feeds | Working |
| Channel browser, join and leave optional channels | Working |
| Post composer with photo upload, priority, pinning | Working |
| Web push notifications, per-channel preferences | Working |
| Home screen, install walkthrough, notification permission | Working |
| Brand theme, PWA manifest, app icons | Working, placeholder shield |
| Resource hub with admin management | Working |
| Staff directory | Working |
| School events calendar with agenda and day views | Working |
| Calendar subscription (ICS) to the phone's own calendar app | Working, parser-tested |
| Day-before event reminders on a schedule | Working |
| Universal search across events, news, resources, staff, channels | Working |

Athletics is deliberately absent. It has its own app; this one links out from
the resource hub.

---

## Setup

Roughly twenty minutes, most of it waiting on Supabase.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Free tier is fine.
2. Open the SQL Editor and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed_channels.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/migrations/0004_events.sql`
3. Go to **Project Settings → API** and copy the project URL, the `anon` key,
   and the `service_role` key.
4. Go to **Authentication → Providers → Email** and turn **off** "Enable email
   signups". Accounts come from the roster import, not from self-signup.
5. Under **Authentication → URL Configuration**, set the Site URL to your app
   address and add `<your-app>/auth/callback` to the redirect allow list.

### 2. Resend

1. Create an account at [resend.com](https://resend.com).
2. Verify the sending domain you want invitations to come from.
3. Create an API key.

### 3. Notification keys

```bash
npx tsx scripts/generate-vapid-keys.ts
```

Put both values in `.env.local` and in Vercel. **Generate these once and never
rotate them.** The public key is baked into every device's push subscription,
so changing it silently stops notifications for everyone who already installed
the app, with no error anywhere to tell you.

### 4. Environment

```bash
cp .env.example .env.local
```

Fill in the Supabase and Resend values. `SUPABASE_SERVICE_ROLE_KEY` bypasses
row-level security and is used only for roster import and invitations, so keep
it server-side and out of version control.

### 5. Run it

```bash
npm install
npm run dev
```

### 6. Make yourself an administrator

Nothing works until one admin account exists. In the Supabase SQL Editor:

```sql
insert into users (email, first_name, last_name, role)
values ('aaron@example.com', 'Aaron', 'Abbott', 'admin');
```

Then go to `/sign-in`, enter that address, and follow the emailed link. For
local development, Supabase shows the link under **Authentication → Users**
instead of sending it.

### 7. Deploy

Push to GitHub, import the repo at [vercel.com](https://vercel.com), and add
the same environment variables. Set `NEXT_PUBLIC_APP_URL` to the live address
before sending any invitations, since that address is baked into every link.

---

## Importing the roster

`/admin/roster` takes a CSV export from FACTS, one row per parent and student.
The same parent appearing on four rows is expected and handled.

The importer:

- guesses which column is which, then lets you correct it
- shows a preview with family, parent and student counts before anything saves
- lists the rows it will skip and why
- is safe to run twice, matching parents by email and students by family plus
  name plus grade

Grades normalize from the many ways an export writes them: `2nd Grade`, `02`,
`2` all land on grade 2. Divisions are assigned automatically (Grammar K-6,
Logic 7-8, Rhetoric 9-12), so no one types a division per row.

To sanity-check a mapping against a sample file before the real import:

```bash
npx tsx scripts/roster-check.ts
```

---

## Notifications

Push is sent directly from the app using the web push standard. There is no
notification vendor and no per-message cost.

**On iPhone, notifications only work from the app installed to the home
screen.** Permission requested from a Safari tab is denied immediately and
permanently, so the app never asks there; it shows the install walkthrough
instead. This is why `/welcome` matters more than any feature in Phase 2, and
why the admin dashboard tracks installs rather than accounts.

Three rules the code enforces:

- Every push is user-visible. iOS revokes subscriptions that send silent
  pushes, so a "quiet" notification would break that device permanently.
- Urgent notices bypass per-channel preferences. Someone who muted the Grammar
  feed still hears that school is closed. Only administrators can send them,
  and the composer asks for confirmation first.
- Dead subscriptions are pruned. A device that returns 404 or 410 has deleted
  the app; its row is removed rather than retried forever.

---

## Testing

```bash
# Row-level security: does a Grammar family really not see Logic posts?
createdb rlstest
psql -d rlstest -f scripts/rls-test.sql

# Roster parser against a messy sample export
npx tsx scripts/roster-check.ts

# Calendar feed against a real iCalendar parser
npx tsx scripts/ics-check.ts
```

`scripts/rls-test.sql` runs the real migrations against a local Postgres with
a small stub of Supabase's auth schema, then queries as four different people
and asserts what each one can see. Fifteen assertions cover division isolation,
a parent being unable to post to a restricted feed, drafts staying invisible,
auto-membership joining a two-division family to both of its grade channels
and neither of anyone else's, and the channel structure itself: three division
feeds, thirteen grade channels, and a parent able to post in their own grade.

It has been checked against a deliberately broken policy to confirm it fails
when the membership check is removed, rather than passing regardless.

The structure assertions exist because of a real bug. The division and grade
channels were correct in the database from the start, but every navigation
filtered to `kind === 'feed'`, so the grade channels were unreachable: families
were members, could post, and had no link to follow. Nothing failed. That is
why `src/lib/channels.ts` is the single loader and why filtering by kind
happens at the call site that wants one kind, never in the loader.

`scripts/ics-check.ts` builds a calendar feed containing the cases that break
iCalendar in practice, then parses it back with `node-ical` and compares. It
checks CRLF endings, line folding at 75 octets with multi-byte characters
intact, escaped commas and semicolons, all-day events using a DATE value,
cancellations, and stable UIDs. That last one matters most: if a UID changed
between fetches, every edit would add a second copy of the event to every
family's phone instead of updating the one already there.

---

## Calendar

Events hang off channels, the same as posts. A Grammar family sees Grammar
events and not Logic ones, notification preferences already exist per channel,
and there is no second permission system to keep in step with the first. The
test suite asserts the calendar's isolation separately from the feed's, so a
drift between them fails rather than going unnoticed.

Two views. **Upcoming** is the default agenda, because a school calendar has
long empty stretches and paging through blank days to find one concert is the
thing families complain about. **By day** is there for "what is happening
Thursday".

Families can subscribe from Settings, which gives the events to the calendar
app already on their phone. The link carries a per-user token, so it works
without signing in; it is revocable from the same screen if someone shares it
by mistake.

Cancelling an event is preferred over deleting it. A family who subscribed
sees the entry turn to CANCELLED rather than silently vanishing from their
phone, and the edit form says so.

Day-before reminders run from `vercel.json` at 22:00 UTC, which is 5pm Central
in daylight time. Set `CRON_SECRET` in Vercel before going live or the endpoint
is open to anyone who guesses the URL. Reminders honor per-channel preferences
and stamp each event as they go, so a retry after a timeout resumes instead of
notifying 400 families twice.

Athletics is not in the calendar. It has its own app and its own schedule; the
resource hub links out to it.

---

## Things to replace before launch

1. **The shield.** `src/components/Shield.tsx` draws a placeholder from the
   brand palette. Drop the official `shield.svg` into `public/brand/` and swap
   the component for an `<img>`. Regenerate the icons in `public/icons/` from
   the real artwork too.
2. **Resource hub links.** The hub is seeded with titles but no URLs,
   including the athletics app link. Fill them in at `/admin/resources`.
   Resources without a link are hidden from families rather than shown as
   dead ends, and the admin screen counts how many are still empty.
3. **`INVITE_FROM_EMAIL`.** Must be an address on a domain verified in Resend,
   or every invitation bounces.

---

## Known open questions

- **Pre-K.** The importer rejects `Pre-K` because the plan scoped grades K-12.
  If Providence enrolls Pre-K, it needs a grade value, a division, and a
  channel before the first import.
- **Staff import.** Parents import from the FACTS export. Staff accounts are
  created by hand for now; a separate staff CSV import is a small addition once
  the staff roster format is known.

---

## Project layout

```
src/
  app/
    admin/            Roster import, invitations, adoption dashboard
    api/admin/        Import and invitation endpoints (server only)
    auth/callback/    Magic-link landing; enforces roster membership
    sign-in/          Passwordless sign-in
    welcome/          Home-screen install walkthrough
  components/         AppShell, RosterImport, InvitationPanel, Shield
  lib/
    auth.ts           Session to app user, role guards
    roster.ts         CSV parsing, column guessing, family grouping
    email.ts          Invitation template
    supabase/         Server, browser and service-role clients
    types.ts          Shared types, grade and division rules, brand colors
supabase/migrations/  Schema and seed data
```

### One design decision worth knowing

Channels, posts and messages are one shape. A division feed is a channel where
only admins may post; a grade group chat is a channel where everyone may; an
announcement is a post with a priority flag. Building these as three separate
systems is the usual way a project like this doubles in size around Phase 3.
