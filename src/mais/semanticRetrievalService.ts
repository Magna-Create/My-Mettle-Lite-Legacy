import type { MaisEmbeddingRepository } from '../adapters/storage/IndexedDbMaisEmbeddingRepository';
import type { MaisEmbeddingRuntime } from './semanticIndexCoordinator';
import {
  chunkSemanticDocument,
  compileSemanticContextSelection,
  createEmbeddingRecord,
  createSemanticIndexManifest,
  rankSemanticChunks,
  stableSemanticHash,
  type MaisEmbeddingRecord,
  type MaisSemanticContextSelection,
  type MaisSemanticDocument,
  type MaisSemanticIndexManifest,
} from './semanticMemory';

export interface MaisSemanticSyncResult {
  manifests: MaisSemanticIndexManifest[];
  embeddedChunkCount: number;
  reusedChunkCount: number;
  removedChunkCount: number;
  remainingChunkCount: number;
}

export interface MaisSemanticSearchResult {
  selection: MaisSemanticContextSelection;
  sync: MaisSemanticSyncResult;
}

function batches<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function currentChunks(documents: MaisSemanticDocument[]) {
  return documents.flatMap((document) => chunkSemanticDocument(document));
}

function vectorIsCompatible(
  record: MaisEmbeddingRecord,
  dimensions: MaisEmbeddingRecord['dimensions'],
  contentHash: string,
): boolean {
  return record.dimensions === dimensions
    && record.modelId === 'google.embeddinggemma'
    && record.contentHash === contentHash
    && record.vector.length === dimensions;
}

export class MaisSemanticRetrievalService {
  constructor(
    private readonly repository: MaisEmbeddingRepository,
    private readonly runtime: MaisEmbeddingRuntime,
    private readonly dimensions: MaisEmbeddingRecord['dimensions'] = 256,
    private readonly batchSize = 8,
    private readonly maximumNewChunksPerSync = 48,
  ) {}

  async synchronise(documents: MaisSemanticDocument[]): Promise<MaisSemanticSyncResult> {
    const chunks = currentChunks(documents);
    const currentChunkIds = new Set(chunks.map((chunk) => chunk.id));
    const existingById = await this.repository.getMany(chunks.map((chunk) => chunk.id));
    const pending = chunks.filter((chunk) => {
      const existing = existingById.get(chunk.id);
      return !existing || !vectorIsCompatible(existing, this.dimensions, chunk.contentHash);
    });
    const selectedPending = pending.slice(0, this.maximumNewChunksPerSync);

    let embeddedChunkCount = 0;
    for (const group of batches(selectedPending, this.batchSize)) {
      const vectors = await this.runtime.embed({
        texts: group.map((chunk) => chunk.text),
        purpose: 'document',
        dimensions: this.dimensions,
      });
      if (vectors.length !== group.length) throw new Error('EmbeddingGemma returned an incomplete indexing batch.');
      const embeddedAt = new Date().toISOString();
      await this.repository.upsert(group.map((chunk, index) => createEmbeddingRecord(
        chunk,
        vectors[index]!,
        this.dimensions,
        embeddedAt,
      )));
      embeddedChunkCount += group.length;
    }

    const allExisting = await this.repository.listAll();
    const staleChunkIds = allExisting
      .filter((record) => record.modelId === 'google.embeddinggemma' && !currentChunkIds.has(record.chunkId))
      .map((record) => record.chunkId);
    await this.repository.deleteChunks(staleChunkIds);

    const indexedAt = new Date().toISOString();
    const manifests = documents.map((document) => createSemanticIndexManifest(
      document,
      chunkSemanticDocument(document),
      this.dimensions,
      indexedAt,
    ));
    return {
      manifests,
      embeddedChunkCount,
      reusedChunkCount: chunks.length - pending.length,
      removedChunkCount: staleChunkIds.length,
      remainingChunkCount: Math.max(0, pending.length - selectedPending.length),
    };
  }

  async search(
    documents: MaisSemanticDocument[],
    query: string,
    options: { topK?: number; tokenBudget?: number; minimumScore?: number; maximumPerDocument?: number } = {},
  ): Promise<MaisSemanticSearchResult> {
    const cleanQuery = query.trim();
    if (!cleanQuery) throw new Error('Semantic retrieval requires a non-empty query.');
    const sync = await this.synchronise(documents);
    const [queryVector] = await this.runtime.embed({ texts: [cleanQuery], purpose: 'query', dimensions: this.dimensions });
    if (!queryVector) throw new Error('EmbeddingGemma did not return a query vector.');

    const chunks = currentChunks(documents);
    const recordsById = await this.repository.getMany(chunks.map((chunk) => chunk.id));
    const compatible = new Map<string, MaisEmbeddingRecord>();
    for (const chunk of chunks) {
      const record = recordsById.get(chunk.id);
      if (record && vectorIsCompatible(record, this.dimensions, chunk.contentHash)) compatible.set(chunk.id, record);
    }
    const ranked = rankSemanticChunks(queryVector, chunks, compatible, {
      topK: options.topK ?? 8,
      maximumPerDocument: options.maximumPerDocument ?? 2,
      minimumScore: options.minimumScore,
    });
    return {
      selection: compileSemanticContextSelection(ranked, options.tokenBudget ?? 1_250),
      sync,
    };
  }
}

export function semanticDocumentSetFingerprint(documents: MaisSemanticDocument[]): string {
  return stableSemanticHash(documents
    .map((document) => `${document.id}:${document.updatedAt}:${chunkSemanticDocument(document).map((chunk) => chunk.contentHash).join(',')}`)
    .sort()
    .join('\n'));
}
