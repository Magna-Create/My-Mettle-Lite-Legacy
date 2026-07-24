export type MaisHighPriorityWorkKind =
  | 'model-import'
  | 'model-load'
  | 'model-generation'
  | 'embedding-index'
  | 'developer-operation';

export interface MaisHighPriorityWorkState {
  active: boolean;
  leaseId: string | null;
  kind: MaisHighPriorityWorkKind | null;
  label: string | null;
  startedAtEpochMs: number | null;
}

type Listener = (state: MaisHighPriorityWorkState) => void;

const idleState: MaisHighPriorityWorkState = {
  active: false,
  leaseId: null,
  kind: null,
  label: null,
  startedAtEpochMs: null,
};

let current: MaisHighPriorityWorkState = idleState;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

function newLeaseId(): string {
  return `mais_high_priority_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readMaisHighPriorityWork(): MaisHighPriorityWorkState {
  return current;
}

export function isMaisHighPriorityWorkActive(): boolean {
  return current.active;
}

export function subscribeMaisHighPriorityWork(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function acquireMaisHighPriorityWork(
  kind: MaisHighPriorityWorkKind,
  label: string,
): { state: MaisHighPriorityWorkState; release: () => void } {
  if (current.active) {
    throw new Error(`A high-priority task is already active: ${current.label ?? current.kind ?? 'unknown task'}.`);
  }

  const leaseId = newLeaseId();
  current = {
    active: true,
    leaseId,
    kind,
    label,
    startedAtEpochMs: Date.now(),
  };
  emit();

  let released = false;
  return {
    state: current,
    release: () => {
      if (released) return;
      released = true;
      if (current.leaseId !== leaseId) return;
      current = idleState;
      emit();
    },
  };
}

export async function withMaisHighPriorityWork<T>(
  kind: MaisHighPriorityWorkKind,
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lease = acquireMaisHighPriorityWork(kind, label);
  try {
    return await operation();
  } finally {
    lease.release();
  }
}
