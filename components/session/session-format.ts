// Display helpers shared by the running workout, the rest screen and the
// summary. Formatting only: every number comes from the caller.

// "01:45", or "1:02:10" past the hour. Negative input reads as zero.
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
    : `${String(minutes).padStart(2, '0')}:${ss}`;
}

// A rest length in words: "3 min", "90 s" stays "1 min 30 s", "45 s".
export function formatRestLength(
  seconds: number,
  t: (key: 'minutes' | 'seconds' | 'minutesSeconds', values: Record<string, number>) => string,
): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return t('seconds', { count: seconds });
  if (rest === 0) return t('minutes', { count: minutes });
  return t('minutesSeconds', { minutes, seconds: rest });
}

// The sets of a session in the sheet's short form: consecutive sets at the
// same load share it, "80 × 10 · 9 · 8"; a change of load starts a new group,
// "80 × 10 · 75 × 9".
export function groupedSetsLine(
  sets: { weight: number; reps: number }[],
  formatLoad: (weight: number) => string,
): string {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const set of sets) {
    const last = groups.at(-1);
    if (last && last.weight === set.weight) last.reps.push(set.reps);
    else groups.push({ weight: set.weight, reps: [set.reps] });
  }
  return groups
    .map((group) => `${formatLoad(group.weight)} × ${group.reps.join(' · ')}`)
    .join(' · ');
}
