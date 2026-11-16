import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { groupFamilies, parseRoster, type RosterField } from '@/lib/roster';

export const maxDuration = 60;

const BodySchema = z.object({
  filename: z.string().optional(),
  mapping: z.record(z.string(), z.string()),
  records: z.array(z.record(z.string(), z.string())).max(5000),
});

/**
 * Commits a roster import.
 *
 * Safe to run more than once. Parents are matched by email, students by
 * family plus first name plus grade, so re-importing an updated export
 * updates rather than duplicates.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { filename, mapping, records } = parsed.data;
  const result = parseRoster(
    records,
    mapping as Partial<Record<RosterField, string>>,
  );
  const families = groupFamilies(result.rows);

  const admin = createAdminClient();

  let usersCreated = 0;
  let usersUpdated = 0;
  let studentsCreated = 0;
  const errors = [...result.errors];

  for (const family of families) {
    try {
      // Find an existing family through any of its parents, so siblings
      // imported in a later run attach to the same family.
      let familyId: string | null = null;

      const emails = family.parents.map((p) => p.email);
      const { data: existingUsers } = await admin
        .from('users')
        .select('id, email, first_name, last_name')
        .in('email', emails);

      if (existingUsers && existingUsers.length > 0) {
        const { data: link } = await admin
          .from('family_members')
          .select('family_id')
          .in(
            'user_id',
            existingUsers.map((u) => u.id),
          )
          .limit(1)
          .maybeSingle();
        familyId = link?.family_id ?? null;
      }

      if (!familyId) {
        const { data: newFamily, error } = await admin
          .from('families')
          .insert({ name: family.name })
          .select('id')
          .single();
        if (error) throw error;
        familyId = newFamily.id;
      }

      // Parents
      for (const parent of family.parents) {
        const existing = existingUsers?.find((u) => u.email === parent.email);

        if (existing) {
          // Only fill in blanks; never overwrite a name someone corrected.
          const patch: Record<string, string> = {};
          if (!existing.first_name && parent.firstName)
            patch.first_name = parent.firstName;
          if (!existing.last_name && parent.lastName)
            patch.last_name = parent.lastName;

          if (Object.keys(patch).length > 0) {
            await admin.from('users').update(patch).eq('id', existing.id);
            usersUpdated += 1;
          }

          await admin
            .from('family_members')
            .upsert(
              { family_id: familyId, user_id: existing.id },
              { onConflict: 'family_id,user_id' },
            );
        } else {
          const { data: created, error } = await admin
            .from('users')
            .insert({
              email: parent.email,
              first_name: parent.firstName,
              last_name: parent.lastName,
              role: 'parent',
            })
            .select('id')
            .single();
          if (error) throw error;

          usersCreated += 1;
          await admin
            .from('family_members')
            .insert({ family_id: familyId, user_id: created.id });
        }
      }

      // Students
      for (const student of family.students) {
        const { data: existingStudent } = await admin
          .from('students')
          .select('id, grade, division')
          .eq('family_id', familyId)
          .ilike('first_name', student.firstName)
          .maybeSingle();

        if (existingStudent) {
          // A student who moved up a grade since the last import.
          if (existingStudent.grade !== student.grade) {
            await admin
              .from('students')
              .update({ grade: student.grade, division: student.division })
              .eq('id', existingStudent.id);
          }
        } else {
          const { error } = await admin.from('students').insert({
            family_id: familyId,
            first_name: student.firstName,
            last_name: student.lastName,
            grade: student.grade,
            division: student.division,
          });
          if (error) throw error;
          studentsCreated += 1;
        }
      }
    } catch (e) {
      errors.push({
        rowNumber: 0,
        reason: `Family "${family.name}": ${
          e instanceof Error ? e.message : 'unknown error'
        }`,
        raw: {},
      });
    }
  }

  const { data: run } = await admin
    .from('import_runs')
    .insert({
      performed_by: user.id,
      filename: filename ?? null,
      rows_total: records.length,
      users_created: usersCreated,
      users_updated: usersUpdated,
      students_created: studentsCreated,
      errors,
    })
    .select('id')
    .single();

  return NextResponse.json({
    importRunId: run?.id ?? null,
    familiesProcessed: families.length,
    usersCreated,
    usersUpdated,
    studentsCreated,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  });
}
