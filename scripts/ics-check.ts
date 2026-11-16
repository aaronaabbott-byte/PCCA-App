/**
 * Verifies the ICS output against a real iCalendar parser.
 *
 * The cases that matter: a long title that must fold at 75 octets, curly
 * punctuation that makes octets and characters diverge, commas and
 * semicolons that must be escaped, an all-day event, and a cancellation.
 */
import ical from 'node-ical';
import { buildIcs } from '../src/lib/ics';
import type { CalendarEvent } from '../src/lib/event-types';

const channel = {
  id: 'c1',
  name: 'Grammar',
  slug: 'grammar',
  division: 'grammar' as const,
};

const events: CalendarEvent[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: "Grammar Christmas Program — Mrs. O'Malley's class, grades 1–3, in the Providence Activities Center",
    description: 'Doors open at 6:00; seating is first come, first served.',
    location: 'Providence Activities Center, 1000 Patriot Way',
    category: 'arts',
    starts_at: '2026-12-11T00:30:00.000Z',
    ends_at: '2026-12-11T02:00:00.000Z',
    all_day: false,
    time_tbd: false,
    cancelled: false,
    channel,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'No School — Thanksgiving Break',
    description: '',
    location: null,
    category: 'schedule',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: null,
    all_day: true,
    time_tbd: false,
    cancelled: false,
    channel,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Fall Festival',
    description: 'Rain date to be announced.',
    location: 'Grammar Campus field',
    category: 'community',
    starts_at: '2026-10-17T15:00:00.000Z',
    ends_at: null,
    all_day: false,
    time_tbd: true,
    cancelled: true,
    channel,
  },
];

const ics = buildIcs(events, {
  calendarName: 'Providence Academy',
  domain: 'app.providenceacademy.org',
});

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`PASS  ${label}`);
  else { console.log(`FAIL  ${label}${detail ? `  (${detail})` : ''}`); failures++; }
}

// --- structural rules -------------------------------------------------------
check('uses CRLF line endings', /\r\n/.test(ics) && !/[^\r]\n/.test(ics));

const rawLines = ics.split('\r\n').filter(Boolean);
const tooLong = rawLines.filter((l) => Buffer.from(l, 'utf8').length > 75);
check('every line folded to 75 octets', tooLong.length === 0,
      tooLong.length ? `${tooLong.length} long: ${tooLong[0].slice(0, 40)}…` : '');

// --- parses ----------------------------------------------------------------
const parsed = ical.sync.parseICS(ics);
const vevents = Object.values(parsed).filter((e: any) => e.type === 'VEVENT') as any[];
check('parses back to 3 events', vevents.length === 3, `got ${vevents.length}`);

const program = vevents.find((e) => String(e.uid).startsWith('11111111'));
check('long title survives folding intact',
      program?.summary === events[0].title,
      `got: ${String(program?.summary).slice(0, 60)}…`);

check('location with a comma is escaped and restored',
      program?.location === events[0].location,
      `got: ${program?.location}`);

check('semicolon in description survives',
      program?.description === events[0].description,
      `got: ${program?.description}`);

const noSchool = vevents.find((e) => String(e.uid).startsWith('22222222'));
check('all-day event uses a DATE value', noSchool?.datetype === 'date',
      `datetype: ${noSchool?.datetype}`);

const festival = vevents.find((e) => String(e.uid).startsWith('33333333'));
check('cancelled event carries STATUS:CANCELLED',
      festival?.status === 'CANCELLED', `status: ${festival?.status}`);
check('cancelled event says so in the title',
      String(festival?.summary).startsWith('CANCELLED:'),
      `summary: ${festival?.summary}`);

check('UIDs are stable and domain-qualified',
      vevents.every((e) => /@app\.providenceacademy\.org$/.test(String(e.uid))));

// Re-generating must produce identical UIDs, or every edit duplicates the
// entry already sitting in a family's phone.
const again = ical.sync.parseICS(
  buildIcs(events, { calendarName: 'Providence Academy', domain: 'app.providenceacademy.org' }),
);
const uidsA = vevents.map((e) => e.uid).sort();
const uidsB = (Object.values(again).filter((e: any) => e.type === 'VEVENT') as any[])
  .map((e) => e.uid).sort();
check('UIDs stable across regeneration', JSON.stringify(uidsA) === JSON.stringify(uidsB));

console.log(failures === 0 ? '\nAll ICS checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
