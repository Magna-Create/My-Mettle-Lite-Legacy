import { openDB, type IDBPDatabase } from 'idb';
import type { MaisRepository } from '../../mais/repository';
import { normaliseMaisSystemSnapshot, type MaisSystemSnapshot } from '../../mais/systemState';

const DATABASE_NAME = 'my-mettle-mais';
const STORE_NAME = 'system-state';
const STATE_KEY = 'primary';

export class IndexedDbMaisRepository implements MaisRepository {
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

  async load(): Promise<MaisSystemSnapshot | null> {
    const database = await this.database();
    const stored = await database.get(STORE_NAME, STATE_KEY);
    if (stored === undefined) return null;
    return normaliseMaisSystemSnapshot(stored);
  }

  async save(snapshot: MaisSystemSnapshot): Promise<void> {
    const database = await this.database();
    await database.put(STORE_NAME, structuredClone(snapshot), STATE_KEY);
  }

  async clear(): Promise<void> {
    const database = await this.database();
    await database.delete(STORE_NAME, STATE_KEY);
  }
}
