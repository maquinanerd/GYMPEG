// Every model that holds a user's data directly (a `userId` column), with how
// erasing the account removes it (LGPD, epic 1.7):
// - cascade: the database deletes it with the User row (onDelete: Cascade);
// - explicit: lib/account-deletion deletes it first, because its relation to
//   User does not cascade (or has no foreign key at all).
// Rows owned through these (sets, workouts, prescriptions, versions,
// messages, gym equipment) go with their parent. The export
// (lib/account-export) includes every model listed here.
// tests/integration/account-data-coverage keeps this list complete.

export type Erasure = 'cascade' | 'explicit';

export const USER_OWNED_MODELS = {
  AuthSession: { delegate: 'authSession', erase: 'cascade' },
  // Only token hashes, dropped from the export like every credential hash.
  PasswordResetToken: { delegate: 'passwordResetToken', erase: 'cascade' },
  McpAccessToken: { delegate: 'mcpAccessToken', erase: 'cascade' },
  McpHistoricalEquipmentBackfillAudit: {
    delegate: 'mcpHistoricalEquipmentBackfillAudit',
    erase: 'cascade',
  },
  ExercisePreference: { delegate: 'exercisePreference', erase: 'cascade' },
  // Sets cascade with their session.
  Session: { delegate: 'session', erase: 'explicit' },
  // Workouts, prescriptions and versions cascade with their program.
  Program: { delegate: 'program', erase: 'explicit' },
  // Messages cascade with their conversation.
  Conversation: { delegate: 'conversation', erase: 'explicit' },
  CoachSession: { delegate: 'coachSession', erase: 'explicit' },
  // Equipment, its images and per-exercise configs cascade with the gym.
  Gym: { delegate: 'gym', erase: 'explicit' },
  // The user's own custom exercises (never the global catalog).
  Exercise: { delegate: 'exercise', erase: 'explicit' },
  ExerciseGoal: { delegate: 'exerciseGoal', erase: 'cascade' },
  VolumeTarget: { delegate: 'volumeTarget', erase: 'cascade' },
  BodyweightEntry: { delegate: 'bodyweightEntry', erase: 'cascade' },
  BodyMeasurement: { delegate: 'bodyMeasurement', erase: 'cascade' },
  // Rows cascade; the image files on disk are removed by the deletion.
  ProgressPhoto: { delegate: 'progressPhoto', erase: 'cascade' },
  ReadinessCheckin: { delegate: 'readinessCheckin', erase: 'cascade' },
  // Engine decisions with their inputs (ADR-007); also cascade with sessions.
  TrainingRecommendation: { delegate: 'trainingRecommendation', erase: 'cascade' },
} as const satisfies Record<string, { delegate: string; erase: Erasure }>;

export type UserOwnedModel = keyof typeof USER_OWNED_MODELS;
