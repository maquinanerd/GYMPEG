import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { USER_OWNED_MODELS } from '@/lib/account-data';

// Ratchet for account erasure and export (LGPD, epic 1.7): every model with a
// `userId` column must be listed in lib/account-data, and the listed way of
// erasing it must hold: a cascading relation to User, or an explicit delete in
// lib/account-deletion. A new user-owned table cannot ship without either.
// This test needs no database; it only reads the tree.

const ROOT = process.cwd();
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
const deletion = readFileSync(join(ROOT, 'lib', 'account-deletion.ts'), 'utf8');

function modelBlocks(): Map<string, string> {
  const blocks = new Map<string, string>();
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    blocks.set(match[1]!, match[2]!);
  }
  return blocks;
}

describe('account data coverage', () => {
  const blocks = modelBlocks();
  const withUserId = [...blocks.entries()]
    .filter(([, body]) => /^\s+userId\s+String/m.test(body))
    .map(([name]) => name)
    .sort();

  it('lists exactly the models that hold a userId', () => {
    expect(withUserId).toEqual(Object.keys(USER_OWNED_MODELS).sort());
  });

  it.each(Object.entries(USER_OWNED_MODELS))('%s is erased as declared', (model, entry) => {
    if (entry.erase === 'cascade') {
      expect(
        blocks.get(model),
        `${model} is declared as cascading but its relation to User does not cascade`,
      ).toMatch(/User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    } else {
      expect(
        deletion,
        `${model} is declared as explicit but lib/account-deletion does not delete it`,
      ).toContain(`tx.${entry.delegate}.deleteMany`);
    }
  });
});
