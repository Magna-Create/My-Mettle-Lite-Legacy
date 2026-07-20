export type ReflectionHapticKind = 'button' | 'slider' | 'slider_extreme';

const patterns: Record<ReflectionHapticKind, number | number[]> = {
  button: 9,
  slider: 4,
  slider_extreme: [12, 6, 18],
};

let lastSliderAt = 0;

export function reflectionHaptic(kind: ReflectionHapticKind) {
  if (!navigator.vibrate) return;
  if (kind === 'slider') {
    const now = performance.now();
    if (now - lastSliderAt < 28) return;
    lastSliderAt = now;
  }
  navigator.vibrate(patterns[kind]);
}
