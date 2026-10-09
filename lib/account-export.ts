// Data portability export (LGPD, epic 1.7): everything the account holds, as
// a ZIP the user downloads. Unlike the backup (app/api/backup), which is a
// restorable subset, this is read-only and complete:
// - data.json: the account profile plus every model in lib/account-data,
//   with their child rows (sets, workouts, versions, messages, equipment);
// - csv/: the training log, bodyweight and measurements for spreadsheets;
// - photos/ and gym-equipment/: the image files.
// Credentials never leave: password and token hashes are dropped.

import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';
import { db } from '@/lib/db';
import { USER_OWNED_MODELS, type UserOwnedModel } from '@/lib/account-data';
import { extensionForMime, readPhotoFile, type ProgressPhotoMime } from '@/lib/progress-photo';

export const EXPORT_FORMAT = 'gympeg-export';
export const EXPORT_VERSION = 1;

// Never exported: credentials, and binary columns that travel as files.
const DROPPED_KEYS = new Set(['passwordHash', 'tokenHash', 'imageData']);

type Row = Record<string, unknown>;
type Loader = (userId: string) => Promise<Row[]>;

// Models whose child rows belong in the export too; every other model of
// lib/account-data is exported as its own rows.
const LOADERS: Partial<Record<UserOwnedModel, Loader>> = {
  Session: (userId) =>
    db.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'asc' },
      include: { sets: { orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }] } },
    }),
  Program: (userId) =>
    db.program.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: { exercises: { orderBy: { order: 'asc' } } },
        },
        revisions: { orderBy: { version: 'asc' } },
      },
    }),
  Conversation: (userId) =>
    db.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    }),
  Gym: (userId) =>
    db.gym.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        exerciseConfigs: true,
        equipment: { include: { exerciseLinks: true } },
      },
    }),
  Exercise: (userId) =>
    db.exercise.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { aliases: true, muscles: true },
    }),
};

function genericLoader(delegate: string): Loader {
  return (userId) =>
    (db as unknown as Record<string, { findMany: (args: unknown) => Promise<Row[]> }>)[
      delegate
    ]!.findMany({ where: { userId } });
}

// Drops credentials and binary columns at any depth.
function clean(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    return Object.fromEntries(
      Object.entries(value as Row)
        .filter(([key]) => !DROPPED_KEYS.has(key))
        .map(([key, item]) => [key, clean(item)]),
    );
  }
  return value;
}

function csvCell(value: unknown): string {
  if (value == null) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.join('|')
        : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Row[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(','));
  return `${lines.join('\n')}\n`;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface AccountExport {
  filename: string;
  stream: ReadableStream<Uint8Array>;
}

export async function buildAccountExport(
  userId: string,
  options: { readme: string; now?: Date },
): Promise<AccountExport> {
  const now = options.now ?? new Date();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const data: Record<string, unknown> = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    account: clean(user),
  };
  const loaded: Partial<Record<UserOwnedModel, Row[]>> = {};
  for (const [model, { delegate }] of Object.entries(USER_OWNED_MODELS) as Array<
    [UserOwnedModel, { delegate: string }]
  >) {
    const rows = await (LOADERS[model] ?? genericLoader(delegate))(userId);
    loaded[model] = rows;
    data[delegate] = clean(rows);
  }

  // Spreadsheet-friendly files.
  const exerciseNames = new Map(
    (
      await db.exercise.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                (loaded.Session ?? []).flatMap((session) =>
                  ((session.sets as Row[]) ?? []).map((set) => String(set.exerciseId)),
                ),
              ),
            ],
          },
        },
        select: { id: true, name: true },
      })
    ).map((exercise) => [exercise.id, exercise.name]),
  );
  const setRows = (loaded.Session ?? []).flatMap((session) =>
    ((session.sets as Row[]) ?? []).map((set) => ({
      ...set,
      sessionStartedAt: session.startedAt,
      exercise: exerciseNames.get(String(set.exerciseId)) ?? set.exerciseId,
    })),
  );
  const csvFiles: Array<[string, string]> = [
    [
      'csv/sets.csv',
      toCsv(setRows, [
        'sessionStartedAt',
        'sessionId',
        'exercise',
        'setNumber',
        'type',
        'weight',
        'reps',
        'rir',
        'rpe',
        'durationSec',
        'distanceM',
        'avgHr',
        'maxHr',
        'targetRepsMin',
        'targetRepsMax',
        'targetRir',
        'notes',
        'completedAt',
      ]),
    ],
    ['csv/bodyweight.csv', toCsv(loaded.BodyweightEntry ?? [], ['measuredAt', 'weightKg', 'note'])],
    [
      'csv/measurements.csv',
      toCsv(loaded.BodyMeasurement ?? [], ['measuredAt', 'site', 'valueCm', 'note']),
    ],
  ];

  // Image files: progress photos from disk, equipment images from the database.
  const photos = (loaded.ProgressPhoto ?? []).map((photo) => ({
    id: String(photo.id),
    storagePath: String(photo.storagePath),
    mime: String(photo.mimeType) as ProgressPhotoMime,
  }));
  const equipmentImages = await db.gymEquipment.findMany({
    where: { gym: { userId }, imageData: { not: null } },
    select: { id: true, imageData: true, imageMimeType: true },
  });

  const zip = new Zip();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      zip.ondata = (err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      };
      const add = (name: string, bytes: Uint8Array, compress = true) => {
        const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
        zip.add(file);
        file.push(bytes, true);
      };
      try {
        add('README.txt', strToU8(options.readme));
        add('data.json', strToU8(JSON.stringify(data, null, 2)));
        for (const [name, text] of csvFiles) add(name, strToU8(text));
        for (const photo of photos) {
          const bytes = await readPhotoFile(photo.storagePath);
          if (bytes) add(`photos/${photo.id}.${extensionForMime(photo.mime)}`, bytes, false);
        }
        for (const image of equipmentImages) {
          if (!image.imageData) continue;
          const extension = IMAGE_EXTENSIONS[image.imageMimeType ?? ''] ?? 'bin';
          add(`gym-equipment/${image.id}.${extension}`, new Uint8Array(image.imageData), false);
        }
        zip.end();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return { filename: `gympeg-export-${now.toISOString().slice(0, 10)}.zip`, stream };
}
