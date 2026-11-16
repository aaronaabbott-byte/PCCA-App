import { normalizeGrade, divisionForGrade, type Division } from '@/lib/types';

/**
 * Roster import.
 *
 * A FACTS export is one row per parent-student pair, so the same parent
 * appears several times and the same family appears once per child. The
 * importer has to collapse that without creating duplicate accounts, and it
 * has to be safe to run twice, because it will be.
 */

export const ROSTER_FIELDS = [
  'parent_email',
  'parent_first_name',
  'parent_last_name',
  'student_first_name',
  'student_last_name',
  'grade',
  'family_name',
] as const;

export type RosterField = (typeof ROSTER_FIELDS)[number];

export const FIELD_LABELS: Record<RosterField, string> = {
  parent_email: 'Parent email',
  parent_first_name: 'Parent first name',
  parent_last_name: 'Parent last name',
  student_first_name: 'Student first name',
  student_last_name: 'Student last name',
  grade: 'Grade',
  family_name: 'Family name (optional)',
};

export const REQUIRED_FIELDS: RosterField[] = [
  'parent_email',
  'student_first_name',
  'grade',
];

/**
 * Guesses which CSV column maps to which field. FACTS, Blackbaud and a
 * hand-built spreadsheet all name these differently, so match on substrings
 * rather than exact headers.
 */
const HEADER_HINTS: Record<RosterField, string[]> = {
  parent_email: ['parent email', 'guardian email', 'email', 'e-mail'],
  parent_first_name: ['parent first', 'guardian first', 'first name', 'parent name'],
  parent_last_name: ['parent last', 'guardian last', 'last name', 'surname'],
  student_first_name: ['student first', 'child first', 'student name', 'child name'],
  student_last_name: ['student last', 'child last'],
  grade: ['grade', 'class of', 'year'],
  family_name: ['family', 'household'],
};

export function guessMapping(headers: string[]): Partial<Record<RosterField, string>> {
  const mapping: Partial<Record<RosterField, string>> = {};
  const used = new Set<string>();

  // Most specific hints first, so "parent email" wins over bare "email".
  for (const field of ROSTER_FIELDS) {
    for (const hint of HEADER_HINTS[field]) {
      const match = headers.find(
        (h) => !used.has(h) && h.toLowerCase().trim().includes(hint),
      );
      if (match) {
        mapping[field] = match;
        used.add(match);
        break;
      }
    }
  }

  return mapping;
}

export interface ParsedRow {
  rowNumber: number;
  parentEmail: string;
  parentFirstName: string;
  parentLastName: string;
  studentFirstName: string;
  studentLastName: string;
  grade: string;
  division: Division;
  familyName: string;
}

export interface RowError {
  rowNumber: number;
  reason: string;
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  familyCount: number;
  parentCount: number;
  studentCount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A family key that groups siblings without needing a family id in the export. */
function familyKey(row: ParsedRow): string {
  return row.familyName.trim().toLowerCase() || row.parentEmail;
}

export function parseRoster(
  records: Record<string, string>[],
  mapping: Partial<Record<RosterField, string>>,
): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  const get = (rec: Record<string, string>, field: RosterField): string => {
    const col = mapping[field];
    if (!col) return '';
    return (rec[col] ?? '').trim();
  };

  records.forEach((rec, i) => {
    const rowNumber = i + 2; // header is row 1

    const parentEmail = get(rec, 'parent_email').toLowerCase();
    if (!parentEmail) {
      errors.push({ rowNumber, reason: 'No parent email', raw: rec });
      return;
    }
    if (!EMAIL_RE.test(parentEmail)) {
      errors.push({
        rowNumber,
        reason: `Email does not look valid: ${parentEmail}`,
        raw: rec,
      });
      return;
    }

    const studentFirstName = get(rec, 'student_first_name');
    if (!studentFirstName) {
      errors.push({ rowNumber, reason: 'No student name', raw: rec });
      return;
    }

    const rawGrade = get(rec, 'grade');
    const grade = normalizeGrade(rawGrade);
    if (!grade) {
      errors.push({
        rowNumber,
        reason: `Grade not recognized: "${rawGrade}"`,
        raw: rec,
      });
      return;
    }

    const division = divisionForGrade(grade);
    if (!division) {
      errors.push({ rowNumber, reason: `No division for grade ${grade}`, raw: rec });
      return;
    }

    const studentLastName = get(rec, 'student_last_name');
    const parentLastName = get(rec, 'parent_last_name');

    rows.push({
      rowNumber,
      parentEmail,
      parentFirstName: get(rec, 'parent_first_name'),
      parentLastName,
      studentFirstName,
      studentLastName: studentLastName || parentLastName,
      grade,
      division,
      familyName:
        get(rec, 'family_name') ||
        studentLastName ||
        parentLastName ||
        parentEmail,
    });
  });

  const families = new Set(rows.map(familyKey));
  const parents = new Set(rows.map((r) => r.parentEmail));
  const students = new Set(
    rows.map((r) => `${familyKey(r)}|${r.studentFirstName}|${r.grade}`),
  );

  return {
    rows,
    errors,
    familyCount: families.size,
    parentCount: parents.size,
    studentCount: students.size,
  };
}

/** Groups parsed rows into the family / parent / student shape the database wants. */
export interface FamilyGroup {
  key: string;
  name: string;
  parents: {
    email: string;
    firstName: string;
    lastName: string;
  }[];
  students: {
    firstName: string;
    lastName: string;
    grade: string;
    division: Division;
  }[];
}

export function groupFamilies(rows: ParsedRow[]): FamilyGroup[] {
  const byFamily = new Map<string, FamilyGroup>();

  for (const row of rows) {
    const key = familyKey(row);
    let group = byFamily.get(key);
    if (!group) {
      group = { key, name: row.familyName, parents: [], students: [] };
      byFamily.set(key, group);
    }

    if (!group.parents.some((p) => p.email === row.parentEmail)) {
      group.parents.push({
        email: row.parentEmail,
        firstName: row.parentFirstName,
        lastName: row.parentLastName,
      });
    }

    const studentExists = group.students.some(
      (s) =>
        s.firstName.toLowerCase() === row.studentFirstName.toLowerCase() &&
        s.grade === row.grade,
    );
    if (!studentExists) {
      group.students.push({
        firstName: row.studentFirstName,
        lastName: row.studentLastName,
        grade: row.grade,
        division: row.division,
      });
    }
  }

  return [...byFamily.values()];
}
