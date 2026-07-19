import { openDB, type IDBPDatabase } from 'idb';
import type { AppDatabase } from '../../domain/model';
import type { GymRepository } from './GymRepository';

const DATABASE_NAME = 'kian-gym-app';
const STORE_NAME = 'app-state';
const STATE_KEY = 'primary';

export class IndexedDbGymRepository implements GymRepository {
  private databasePromise: Promise<IDBPDatabase> | null = null;

  private database(): Promise<IDBPDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openDB(DATABASE_NAME, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        },
      });
    }
    return this.databasePromise;
  }

  async load(): Promise<AppDatabase | null> {
    const database = await this.database();
    const value = await database.get(STORE_NAME, STATE_KEY);
    return (value as AppDatabase | undefined) ?? null;
  }

  async save(state: AppDatabase): Promise<void> {
    const database = await this.database();
    await database.put(STORE_NAME, state, STATE_KEY);
  }

  async clear(): Promise<void> {
    const database = await this.database();
    await database.delete(STORE_NAME, STATE_KEY);
  }
}
