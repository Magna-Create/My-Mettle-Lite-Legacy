import { describe, expect, it } from 'vitest';
import type { MaisEmbeddingRepository } from '../src/adapters/storage/IndexedDbMaisEmbeddingRepository';
import type { MaisEmbeddingRuntime } from '../src/mais/semanticIndexCoordinator';
import type { MaisEmbeddingRecord, MaisSemanticDocument } from '../src/mais/semanticMemory';
import { MaisSemanticRetrievalService } from '../src/mais/semanticRetrievalService';

class MemoryEmbeddingRepository implements MaisEmbeddingRepository {
  readonly records = new Map<string, MaisEmbeddingRecord>();
  async upsert(records: MaisEmbeddingRecord[]) { for (const record of records) this.records.set(record.chunkId, structuredClone(record)); }
  async get(chunkId: string) { return this.records.get(chunkId) ?? null; }
  async getMany(chunkIds: string[]) { return new Map(chunkIds.flatMap((id) => this.records.has(id) ? [[id, this.records.get(id)!] as const] : [])); }
  async listByDocument(documentId: string) { return [...this.records.values()].filter((record) => record.documentId === documentId); }
  async listAll() { return [...this.records.values()]; }
  async deleteDocument(documentId: string) { for (const [id, record] of this.records) if (record.documentId === documentId) this.records.delete(id); }
  async deleteChunks(chunkIds: string[]) { for (const id of chunkIds) this.records.delete(id); }
  async clear() { this.records.clear(); }
}

class FakeEmbeddingRuntime implements MaisEmbeddingRuntime {
  documentCalls = 0;
  queryCalls = 0;
  isAvailable() { return true; }
  async embed(input: { texts: string[]; purpose: 'document' | 'query'; dimensions: 128 | 256 | 512 | 768 }) {
    if (input.purpose === 'document') this.documentCalls += input.texts.length;
    else this.queryCalls += input.texts.length;
    return input.texts.map((text) => {
      const vector = new Float32Array(input.dimensions);
      const lower = text.toLowerCase();
      vector[0] = lower.includes('squat') ? 1 : 0.05;
      vector[1] = lower.includes('press') ? 1 : 0.05;
      vector[2] = lower.includes('comfort') ? 1 : 0.05;
      return vector;
    });
  }
}

function document(id: string, title: string, text: string): MaisSemanticDocument {
  return {
    id,
    kind: 'exercise_history',
    title,
    summary: text,
    updatedAt: '2026-07-21T18:00:00.000Z',
    metadata: {},
    sections: [{ key: 'main', heading: title, text, provenanceRefs: [`source_${id}`] }],
  };
}

describe('MAIS semantic retrieval service', () => {
  it('embeds new chunks once and reuses unchanged vectors on later searches', async () => {
    const repository = new MemoryEmbeddingRepository();
    const runtime = new FakeEmbeddingRuntime();
    const service = new MaisSemanticRetrievalService(repository, runtime, 128, 8);
    const documents = [
      document('squat', 'Hack squat', 'Squat performance and knee comfort were stable.'),
      document('press', 'Incline press', 'Press repetitions increased at the same load.'),
    ];

    const first = await service.search(documents, 'Why did squat comfort change?', { topK: 2 });
    expect(first.sync.embeddedChunkCount).toBeGreaterThan(0);
    expect(first.selection.matches[0]!.chunk.documentId).toBe('squat');
    const documentCalls = runtime.documentCalls;

    const second = await service.search(documents, 'Review squat comfort.', { topK: 2 });
    expect(second.sync.embeddedChunkCount).toBe(0);
    expect(second.sync.reusedChunkCount).toBeGreaterThan(0);
    expect(runtime.documentCalls).toBe(documentCalls);
    expect(runtime.queryCalls).toBe(2);
  });

  it('removes stale vectors when the current semantic document set changes', async () => {
    const repository = new MemoryEmbeddingRepository();
    const runtime = new FakeEmbeddingRuntime();
    const service = new MaisSemanticRetrievalService(repository, runtime, 128, 8);
    await service.synchronise([document('old', 'Old exercise', 'Old press evidence.')]);
    expect((await repository.listAll()).some((record) => record.documentId === 'old')).toBe(true);

    const result = await service.synchronise([document('new', 'New exercise', 'New squat evidence.')]);
    expect(result.removedChunkCount).toBeGreaterThan(0);
    expect((await repository.listAll()).some((record) => record.documentId === 'old')).toBe(false);
  });
});
