import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const DIVISIONS = [
  'all_campus',
  'grammar',
  'logic',
  'rhetoric',
  'fine_arts',
  'staff',
] as const;

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(400).nullable().optional(),
  url: z.string().url().or(z.literal('')).nullable().optional(),
  category: z.string().min(1).max(60),
  division: z.enum(DIVISIONS).default('all_campus'),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const parsed = UpsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { id, ...fields } = parsed.data;

  const row = {
    ...fields,
    description: fields.description ?? null,
    url: fields.url === '' ? null : (fields.url ?? null),
  };

  const query = id
    ? admin.from('resources').update(row).eq('id', id).select('id').single()
    : admin.from('resources').insert(row).select('id').single();

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await request.json().catch(() => ({ id: null }));
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from('resources').delete().eq('id', id);

  return NextResponse.json({ ok: true });
}
