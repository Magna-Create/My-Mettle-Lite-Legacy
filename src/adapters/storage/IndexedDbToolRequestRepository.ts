import { openDB, type IDBPDatabase } from 'idb';
import { createMaisToolRequestState, normaliseMaisToolRequestState, type MaisToolRequestState } from '../../mais/toolRequestBroker';

const DATABASE_NAME = 'my-mettle-tool-requests';
const STORE_NAME = 'request-state';
const STATE_KEY = 'primary';

export class IndexedDbToolRequestRepository {
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

  async load(): Promise<MaisToolRequestState> {
    const database = await this.database();
    const stored = await database.get(STORE_NAME, STATE_KEY);
    return stored === undefined ? createMaisToolRequestState() : normaliseMaisToolRequestState(stored);
  }

  async save(state: MaisToolRequestState): Promise<void> {
    const database = await this.database();
    await database.put(STORE_NAME, structuredClone(normaliseMaisToolRequestState(state)), STATE_KEY);
  }

  async clear(): Promise<void> {
    const database = await this.database();
    await database.delete(STORE_NAME, STATE_KEY);
  }
}
