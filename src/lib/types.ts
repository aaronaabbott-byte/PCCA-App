export type AppRole = 'parent' | 'teacher' | 'division_lead' | 'admin' | 'student';

export type Division =
  | 'all_campus'
  | 'grammar'
  | 'logic'
  | 'rhetoric'
  | 'fine_arts'
  | 'staff';

export type ChannelKind = 'feed' | 'group' | 'direct';
export type PostPriority = 'normal' | 'announcement' | 'emergency';
export type InviteStatus = 'not_sent' | 'sent' | 'accepted' | 'bounced';

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  title: string | null;
  department: string | null;
  staff_division: Division | null;
  invite_status: InviteStatus;
  invited_at: string | null;
  accepted_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  grade: string;
  division: Division;
}

export interface Channel {
  id: string;
  slug: string;
  name: string;
  kind: ChannelKind;
  division: Division;
  grade: string | null;
  description: string | null;
  restricted_posting: boolean;
  auto_join: boolean;
  sort_order: number;
  archived: boolean;
}

export interface Post {
  id: string;
  channel_id: string;
  author_id: string;
  title: string;
  body: string;
  hero_image_url: string | null;
  priority: PostPriority;
  published_at: string | null;
  pinned_until: string | null;
  created_at: string;
}

/** Grades K-12 in school order. */
export const GRADES = [
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
] as const;

/**
 * The classical division each grade belongs to. Used by the roster importer
 * so admins never have to type a division per row.
 */
export function divisionForGrade(grade: string): Division | null {
  const g = grade.trim().toUpperCase();
  if (g === 'K' || g === 'KG' || g === 'KINDERGARTEN') return 'grammar';
  const n = Number.parseInt(g, 10);
  if (Number.isNaN(n)) return null;
  if (n >= 1 && n <= 6) return 'grammar';
  if (n >= 7 && n <= 8) return 'logic';
  if (n >= 9 && n <= 12) return 'rhetoric';
  return null;
}

/** Normalizes the many ways a grade appears in an exported roster. */
export function normalizeGrade(raw: string): string | null {
  const g = raw.trim().toUpperCase().replace(/(ST|ND|RD|TH)\s*GRADE$/i, '').trim();
  if (['K', 'KG', 'KINDER', 'KINDERGARTEN', '00', '0'].includes(g)) return 'K';
  const n = Number.parseInt(g, 10);
  if (Number.isNaN(n) || n < 1 || n > 12) return null;
  return String(n);
}

export const DIVISION_LABELS: Record<Division, string> = {
  all_campus: 'All-Campus',
  grammar: 'Grammar',
  logic: 'Logic',
  rhetoric: 'Rhetoric',
  fine_arts: 'Fine Arts',
  staff: 'Staff',
};

/** Brand-guide colors, one per division. */
export const DIVISION_COLORS: Record<Division, string> = {
  all_campus: '#032341', // Midnight Navy
  grammar: '#CB122D',    // Valor Red
  logic: '#003A70',      // Colonial Blue
  rhetoric: '#474747',   // Monument Gray
  fine_arts: '#003A70',  // Colonial Blue
  staff: '#032341',      // Midnight Navy
};

export const ROLE_LABELS: Record<AppRole, string> = {
  parent: 'Parent',
  teacher: 'Teacher',
  division_lead: 'Division Lead',
  admin: 'Administrator',
  student: 'Student',
};
