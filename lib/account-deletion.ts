// Erasing an account (LGPD, epic 1.7): every row of the user's data, their
// progress-photo files, and a minimal record that the erasure happened
// (AccountDeletion: a one-way hash of the id and row counts, nothing about
// the person). lib/account-data lists what each step covers.

import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { deleteUserPhotoDir } from '@/lib/progress-photo';

export type DeletionCounts = Record<string, number>;

export function deletionSubjectHash(userId: string): string {
  return createHash('sha256').update(`gympeg-account:${userId}`).digest('hex');
}

export async function deleteAccount(userId: string): Promise<DeletionCounts> {
  const counts = await db.$transaction(
    async (tx) => {
      const counted: DeletionCounts = {
        sets: await tx.set.count({ where: { session: { userId } } }),
        progressPhotos: await tx.progressPhoto.count({ where: { userId } }),
        bodyweightEntries: await tx.bodyweightEntry.count({ where: { userId } }),
        bodyMeasurements: await tx.bodyMeasurement.count({ where: { userId } }),
      };
      // Order matters where relations do not cascade from User:
      // sessions before programs (Session -> Program is RESTRICT), and the
      // custom exercises last, once nothing of this user points to them.
      counted.sessions = (await tx.session.deleteMany({ where: { userId } })).count;
      counted.programs = (await tx.program.deleteMany({ where: { userId } })).count;
      counted.conversations = (await tx.conversation.deleteMany({ where: { userId } })).count;
      counted.coachSessions = (await tx.coachSession.deleteMany({ where: { userId } })).count;
      await tx.user.update({ where: { id: userId }, data: { activeGymId: null } });
      counted.gyms = (await tx.gym.deleteMany({ where: { userId } })).count;
      counted.exercises = (await tx.exercise.deleteMany({ where: { userId } })).count;
      // Everything else cascades with the user row (lib/account-data).
      await tx.user.delete({ where: { id: userId } });
      await tx.accountDeletion.create({
        data: { subjectHash: deletionSubjectHash(userId), counts: counted },
      });
      return counted;
    },
    { timeout: 60_000 },
  );

  // Files after the commit: a failed transaction must not lose photos. A
  // file left behind is logged; the rows pointing to it are already gone.
  try {
    await deleteUserPhotoDir(userId);
  } catch (err) {
    console.error('[account-deletion] photo files left on disk:', err);
  }
  return counts;
}
