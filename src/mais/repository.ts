import type { MaisSystemSnapshot } from './systemState';

export interface MaisRepository {
  load(): Promise<MaisSystemSnapshot | null>;
  save(snapshot: MaisSystemSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryMaisRepository implements MaisRepository {
  private value: MaisSystemSnapshot | null = null;

  async load(): Promise<MaisSystemSnapshot | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  async save(snapshot: MaisSystemSnapshot): Promise<void> {
    this.value = structuredClone(snapshot);
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}
