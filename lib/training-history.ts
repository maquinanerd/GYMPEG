// Compact text for one logged set in the chat's training history, so the
// coach can read many sessions without a JSON object per set. Strength sets
// read "80 kg x 8 @RIR 2"; cardio sets read "25 min, 5.00 km". The weight is
// the effective load (bodyweight included when the exercise uses it), like the
// rest of the coach payload.
export function describeSet(set: {
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  durationSec: number | null;
  distanceM: number | null;
}): string {
  let text: string;
  if (set.durationSec != null) {
    const minutes = Math.round(set.durationSec / 60);
    text = `${minutes} min`;
    if (set.distanceM != null && set.distanceM > 0) {
      text += `, ${(set.distanceM / 1000).toFixed(2)} km`;
    }
  } else {
    const weight = Number.isInteger(set.weight) ? String(set.weight) : set.weight.toFixed(1);
    text = `${weight} kg x ${set.reps}`;
    if (set.rir != null) text += ` @RIR ${set.rir}`;
  }
  if (set.isWarmup) text += ' (warm-up)';
  if (set.isDropSet) text += ' (drop set)';
  return text;
}
