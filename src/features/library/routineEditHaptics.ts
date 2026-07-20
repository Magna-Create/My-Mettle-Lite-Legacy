type RoutineEditHaptic = 'lift' | 'shuffle' | 'change_day' | 'place' | 'reject';

const patterns: Record<RoutineEditHaptic, number | number[]> = {
  lift: 14,
  shuffle: [3, 5, 3],
  change_day: [5, 7, 5],
  place: [18, 8, 11],
  reject: [22, 16, 22],
};

let lastShuffleAt = 0;

export function routineEditHaptic(kind: RoutineEditHaptic) {
  if (!navigator.vibrate) return;
  if (kind === 'shuffle') {
    const now = performance.now();
    if (now - lastShuffleAt < 48) return;
    lastShuffleAt = now;
  }
  navigator.vibrate(patterns[kind]);
}
