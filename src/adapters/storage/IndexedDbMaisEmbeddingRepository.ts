import { openDB, type IDBPDatabase } from 'idb';
import type { MaisEmbeddingRecord } from '../../mais/semanticMemory';

const DATABASE_NAME = 'my-mettle-mais-vectors';
const DATABASE_VERSION = 1;
const STORE_NAME = 'embeddings';
const DOCUMENT_INDEX = 'documentId';

export interface MaisEmbeddingRepository {
  upsert(records: MaisEmbeddingRecord[]): Promise<void>;
  get(chunkId: string): Promise<MaisEmbeddingRecord | null>;
  getMany(chunkIds: string[]): Promise<Map<string, MaisEmbeddingRecord>>;
  listByDocument(documentId: string): Promise<MaisEmbeddingRecord[]>;
  listAll(): Promise<MaisEmbeddingRecord[]>;
  deleteDocument(documentId: string): Promise<void>;
  deleteChunks(chunkIds: string[]): Promise<void>;
  clear(): Promise<void>;
}

function normaliseRecord(value: MaisEmbeddingRecord): MaisEmbeddingRecord {
  return {
    ...structuredClone(value),
    vector: value.vector instanceof Float32Array ? new Float32Array(value.vector) : Float32Array.from(value.vector),
  };
}

export class IndexedDbMaisEmbeddingRepository implements MaisEmbeddingRepository {
  private databasePromise: Promise<IDBPDatabase> | null = null;

  private database(): Promise<IDBPDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'chunkId' });
            store.createIndex(DOCUMENT_INDEX, 'documentId');
          }
        },
      });
    }
    return this.databasePromise;
  }

  async upsert(records: MaisEmbeddingRecord[]): Promise<void> {
    if (records.length === 0) return;
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...records.map((record) => transaction.store.put(normaliseRecord(record))),
      transaction.done,
    ]);
  }

  async get(chunkId: string): Promise<MaisEmbeddingRecord | null> {
    const database = await this.database();
    const value = await database.get(STORE_NAME, chunkId) as MaisEmbeddingRecord | undefined;
    return value ? normaliseRecord(value) : null;
  }

  async getMany(chunkIds: string[]): Promise<Map<string, MaisEmbeddingRecord>> {
    const database = await this.database();
    const entries = await Promise.all(chunkIds.map(async (chunkId) => {
      const value = await database.get(STORE_NAME, chunkId) as MaisEmbeddingRecord | undefined;
      return value ? [chunkId, normaliseRecord(value)] as const : null;
    }));
    return new Map(entries.filter((entry): entry is readonly [string, MaisEmbeddingRecord] => Boolean(entry)));
  }

  async listByDocument(documentId: string): Promise<MaisEmbeddingRecord[]> {
    const database = await this.database();
    const values = await database.getAllFromIndex(STORE_NAME, DOCUMENT_INDEX, documentId) as MaisEmbeddingRecord[];
    return values.map(normaliseRecord);
  }

  async listAll(): Promise<MaisEmbeddingRecord[]> {
    const database = await this.database();
    const values = await database.getAll(STORE_NAME) as MaisEmbeddingRecord[];
    return values.map(normaliseRecord);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const records = await this.listByDocument(documentId);
    await this.deleteChunks(records.map((record) => record.chunkId));
  }

  async deleteChunks(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...chunkIds.map((chunkId) => transaction.store.delete(chunkId)),
      transaction.done,
    ]);
  }

  async clear(): Promise<void> {
    const database = await this.database();
    await database.clear(STORE_NAME);
  }
}
