import type { CalendarEvent } from '@/lib/event-types';

/**
 * iCalendar (RFC 5545) generation.
 *
 * Written by hand rather than pulled from a library because the format is
 * small and the rules that matter are unforgiving: CRLF line endings, lines
 * folded at 75 octets, and a stable UID per event so that an edit updates
 * the entry already sitting in someone's phone instead of adding a second
 * copy of it.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** UTC timestamp: 20260921T153000Z */
function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** Date only, for all-day events: 20260921 */
function dateStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Folds a content line to 75 octets, continuing with a leading space.
 * Counting octets rather than characters matters as soon as a title
 * contains a curly apostrophe, which school calendars are full of.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    const limit = start === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);

    // Do not split a multi-byte character: back up to a lead byte.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;

    chunks.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }

  return chunks.join('\r\n ');
}

export interface IcsOptions {
  calendarName: string;
  /** Host portion used to build stable UIDs, e.g. app.providenceacademy.org */
  domain: string;
}

export function buildIcs(
  events: CalendarEvent[],
  { calendarName, domain }: IcsOptions,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Providence Academy//Community App//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-PUBLISHED-TTL:PT1H',
    // Tells Apple and Google to re-check roughly hourly rather than daily,
    // which matters when an early dismissal is added the night before.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  const now = utcStamp(new Date());

  for (const event of events) {
    const start = new Date(event.starts_at);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@${domain}`);
    lines.push(`DTSTAMP:${now}`);

    if (event.all_day) {
      const next = new Date(start.getTime() + 86_400_000);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(next)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`);
      const end = event.ends_at
        ? new Date(event.ends_at)
        : new Date(start.getTime() + 3_600_000);
      lines.push(`DTEND:${utcStamp(end)}`);
    }

    const title = event.cancelled
      ? `CANCELLED: ${event.title}`
      : event.time_tbd
        ? `${event.title} (time TBD)`
        : event.title;

    lines.push(fold(`SUMMARY:${escapeText(title)}`));

    if (event.description) {
      lines.push(fold(`DESCRIPTION:${escapeText(event.description)}`));
    }
    if (event.location) {
      lines.push(fold(`LOCATION:${escapeText(event.location)}`));
    }

    lines.push(fold(`CATEGORIES:${escapeText(event.channel.name)}`));
    lines.push(`STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF. Some clients tolerate LF; Outlook does not.
  return `${lines.join('\r\n')}\r\n`;
}
