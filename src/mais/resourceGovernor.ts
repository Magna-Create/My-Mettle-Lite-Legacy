import type { MaisModelTier, MaisResourceMode, MaisResourceSnapshot } from './contracts';

export function deriveMaisResourceMode(snapshot: MaisResourceSnapshot): MaisResourceMode {
  if (snapshot.appVisibility === 'closed' || snapshot.userPaused) return 'paused';

  if (
    snapshot.batterySaver
    || snapshot.activeWorkoutInteraction
    || snapshot.appVisibility === 'background'
    || (snapshot.availableMemoryMb !== undefined && snapshot.availableMemoryMb < 1_500)
  ) {
    return 'light';
  }

  if (snapshot.availableMemoryMb !== undefined && snapshot.availableMemoryMb < 3_000) {
    return 'standard';
  }

  return 'full';
}

export function resourceModeAllowsTier(mode: MaisResourceMode, tier: MaisModelTier): boolean {
  if (mode === 'paused') return false;
  if (mode === 'light') return tier === 'light';
  if (mode === 'standard') return tier !== 'deep';
  return true;
}
