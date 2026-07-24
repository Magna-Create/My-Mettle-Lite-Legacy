import { openDB, type IDBPDatabase } from 'idb';
import {
  createHealthEvidenceSnapshot,
  HEALTH_EVIDENCE_SCHEMA_VERSION,
  type MaisHealthEvidenceSnapshot,
  type MaisManualBodyCompositionRecord,
} from '../../health/healthEvidence';

const DATABASE_NAME = 'my-mettle-health-evidence';
const STORE_NAME = 'health-state';
const STATE_KEY = 'primary';

function normalise(value: unknown): MaisHealthEvidenceSnapshot {
  const base = createHealthEvidenceSnapshot();
  if (!value || typeof value !== 'object') return base;
  const stored = value as Partial<MaisHealthEvidenceSnapshot>;
  return {
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
    observations: structuredClone(stored.observations ?? []),
    manualBodyComposition: structuredClone(stored.manualBodyComposition ?? []),
    sessionEvidence: structuredClone(stored.sessionEvidence ?? []),
    lastSyncedAt: stored.lastSyncedAt,
    lastError: stored.lastError,
    createdAt: stored.createdAt ?? base.createdAt,
    updatedAt: stored.updatedAt ?? base.updatedAt,
  };
}

export class IndexedDbHealthEvidenceRepository {
  private databasePromise: Promise<IDBPDatabase> | null = null;

  private database(): Promise<IDBPDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openDB(DATABASE_NAME, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
        },
      });
    }
    return this.databasePromise;
  }

  async load(): Promise<MaisHealthEvidenceSnapshot> {
    const database = await this.database();
    return normalise(await database.get(STORE_NAME, STATE_KEY));
  }

  async save(snapshot: MaisHealthEvidenceSnapshot): Promise<void> {
    const database = await this.database();
    await database.put(STORE_NAME, structuredClone(snapshot), STATE_KEY);
  }

  async addManualBodyComposition(record: MaisManualBodyCompositionRecord): Promise<MaisHealthEvidenceSnapshot> {
    const snapshot = await this.load();
    const records = new Map(snapshot.manualBodyComposition.map((candidate) => [candidate.id, candidate]));
    records.set(record.id, structuredClone(record));
    const next: MaisHealthEvidenceSnapshot = {
      ...snapshot,
      manualBodyComposition: [...records.values()]
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
        .slice(-2_000),
      updatedAt: new Date().toISOString(),
    };
    await this.save(next);
    return next;
  }

  async deleteManualBodyComposition(recordId: string): Promise<MaisHealthEvidenceSnapshot> {
    const snapshot = await this.load();
    const next = {
      ...snapshot,
      manualBodyComposition: snapshot.manualBodyComposition.filter((record) => record.id !== recordId),
      updatedAt: new Date().toISOString(),
    };
    await this.save(next);
    return next;
  }

  async clear(): Promise<void> {
    const database = await this.database();
    await database.delete(STORE_NAME, STATE_KEY);
  }
}
