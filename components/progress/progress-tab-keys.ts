// The Evolução tabs, in order, as kept in the ?tab= search param. A plain
// module (not 'use client') so the server page can parse the param too.
export const PROGRESS_TABS = ['week', 'training', 'body', 'records'] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number];

export function parseProgressTab(value: string | undefined | null): ProgressTab {
  return PROGRESS_TABS.find((tab) => tab === value) ?? 'week';
}
