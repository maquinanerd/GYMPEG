import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Ratchet for program versions (epic 1.6): every file that writes the
// structure of a program (Program, Workout, ProgramExercise) must record a
// version (lib/program-revisions), so a new write path cannot silently skip
// the history. Writes that do not change the structure are listed below with
// the reason. This test needs no database; it only reads the tree.

const ROOT = process.cwd();
const WRITE =
  /\.(program|workout|programExercise)\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(/;
const RECORDS = /recordProgramRevision|restoreProgramRevision/;

const NOT_STRUCTURAL: Record<string, string> = {
  'app/api/programs/[id]/activate/route.ts': 'only flips isActive, which is not part of a version',
  'app/api/programs/from-template/route.ts':
    'activates the program; buildProgramFromGenerated records its first version',
  'lib/catalog/sync.ts':
    'points prescriptions from a merged legacy copy to the catalog exercise (same exercise)',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'generated')
        out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

describe('program version coverage ratchet', () => {
  const writers = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'lib'))].filter(
    (file) => WRITE.test(readFileSync(join(ROOT, file), 'utf8')),
  );

  it('finds the program write paths (sanity: the scan is not silently empty)', () => {
    expect(writers.length).toBeGreaterThanOrEqual(10);
  });

  it.each(writers)('%s records a program version or is listed as not structural', (file) => {
    if (NOT_STRUCTURAL[file]) return;
    expect(
      RECORDS.test(readFileSync(join(ROOT, file), 'utf8')),
      `${file} writes a program's structure without recording a version. Call ` +
        `recordProgramRevision() after the write (or list it in NOT_STRUCTURAL with the reason).`,
    ).toBe(true);
  });

  it('lists only exemptions that still exist and still write', () => {
    for (const file of Object.keys(NOT_STRUCTURAL)) {
      expect(existsSync(join(ROOT, file)), `${file} is exempted but missing`).toBe(true);
      expect(writers, `${file} is exempted but no longer writes a program`).toContain(file);
    }
  });
});
