import type { AppDatabase } from '../domain/model';
import type { MaisEmbeddingRepository } from '../adapters/storage/IndexedDbMaisEmbeddingRepository';
import { buildTrainingSemanticDocuments, diffSemanticDocuments } from './semanticDocuments';
import {
  MAIS_DEFAULT_EMBEDDING_DIMENSIONS,
  chunkSemanticDocument,
  compileSemanticContextSelection,
  createEmbeddingRecord,
  createSemanticIndexManifest,
  rankSemanticChunks,
  type MaisEmbeddingRecord,
  type MaisSemanticChunk,
  type MaisSemanticContextSelection,
  type MaisSemanticDocument,
  type MaisSemanticDocumentKind,
  type MaisSemanticIndexManifest,
} from './semanticMemory';

export interface MaisEmbeddingRuntime {
  embed(input: {
    texts: string[];
    purpose: 'document' | 'query';
    dimensions: MaisEmbeddingRecord['dimensions'];
  }): Promise<ArrayLike<number>[]>;
}

export interface MaisSemanticIndexPlan {
  pendingDocuments: MaisSemanticDocument[];
  pendingChunks: MaisSemanticChunk[];
  unchangedDocuments: MaisSemanticDocument[];
  removedDocumentIds: string[];
  currentDocuments: MaisSemanticDocument[];
}

export interface MaisSemanticIndexResult {
  manifests: MaisSemanticIndexManifest[];
  indexedDocumentIds: string[];
  indexedChunkCount: number;
  removedDocumentIds: string[];
  unchangedDocumentIds: string[];
}

export interface MaisSemanticSearchRequest {
  query: string;
  topK: number;
  maximumPerDocument: number;
  contextTokenBudget: number;
  kinds?: MaisSemanticDocumentKind[] | undefined;
  minimumScore?: number | undefined;
}

export interface MaisSemanticSearchResult {
  selection: MaisSemanticContextSelection;
  queryDimensions: MaisEmbeddingRecord['dimensions'];
  indexedChunkCount: number;
  missingEmbeddingChunkIds: string[];
}

function chunkTextForEmbedding(chunk: MaisSemanticChunk): string {
  return `title: ${chunk.documentTitle}\nsection: ${chunk.sectionHeading}\n${chunk.text}`;
}

function queryText(query: string): string {
  return `task: search result | query: ${query.trim()}`;
}

function chunksForDocuments(documents: MaisSemanticDocument[]): MaisSemanticChunk[] {
  return documents.flatMap((document) => chunkSemanticDocument(document));
}

function replaceManifests(
  existing: MaisSemanticIndexManifest[],
  replacements: MaisSemanticIndexManifest[],
  removedDocumentIds: string[],
): MaisSemanticIndexManifest[] {
  const removed = new Set([...removedDocumentIds, ...replacements.map((manifest) => manifest.documentId)]);
  return [
    ...existing.filter((manifest) => !removed.has(manifest.documentId)),
    ...replacements,
  ].sort((left, right) => left.documentId.localeCompare(right.documentId));
}

export class MaisSemanticIndexCoordinator {
  constructor(
    private readonly repository: MaisEmbeddingRepository,
    private readonly runtime: MaisEmbeddingRuntime,
    private readonly dimensions: MaisEmbeddingRecord['dimensions'] = MAIS_DEFAULT_EMBEDDING_DIMENSIONS,
    private readonly batchSize = 16,
  ) {
    if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('Semantic embedding batch size must be positive.');
  }

  plan(database: AppDatabase, manifests: MaisSemanticIndexManifest[]): MaisSemanticIndexPlan {
    const currentDocuments = buildTrainingSemanticDocuments(database);
    const diff = diffSemanticDocuments(currentDocuments, manifests);
    return {
      pendingDocuments: diff.pending,
      pendingChunks: chunksForDocuments(diff.pending),
      unchangedDocuments: diff.unchanged,
      removedDocumentIds: diff.removedDocumentIds,
      currentDocuments,
    };
  }

  async execute(
    plan: MaisSemanticIndexPlan,
    existingManifests: MaisSemanticIndexManifest[],
    indexedAt = new Date().toISOString(),
  ): Promise<MaisSemanticIndexResult> {
    for (const documentId of plan.removedDocumentIds) await this.repository.deleteDocument(documentId);
    for (const document of plan.pendingDocuments) await this.repository.deleteDocument(document.id);

    const chunksByDocument = new Map<string, MaisSemanticChunk[]>();
    for (const chunk of plan.pendingChunks) {
      const current = chunksByDocument.get(chunk.documentId) ?? [];
      current.push(chunk);
      chunksByDocument.set(chunk.documentId, current);
    }

    for (let start = 0; start < plan.pendingChunks.length; start += this.batchSize) {
      const batch = plan.pendingChunks.slice(start, start + this.batchSize);
      const vectors = await this.runtime.embed({
        texts: batch.map(chunkTextForEmbedding),
        purpose: 'document',
        dimensions: this.dimensions,
      });
      if (vectors.length !== batch.length) throw new Error('Embedding runtime returned the wrong number of document vectors.');
      await this.repository.upsert(batch.map((chunk, index) => createEmbeddingRecord(
        chunk,
        vectors[index] ?? [],
        this.dimensions,
        indexedAt,
      )));
    }

    const replacements = plan.pendingDocuments.map((document) => createSemanticIndexManifest(
      document,
      chunksByDocument.get(document.id) ?? [],
      this.dimensions,
      indexedAt,
    ));
    const manifests = replaceManifests(existingManifests, replacements, plan.removedDocumentIds);

    return {
      manifests,
      indexedDocumentIds: replacements.map((manifest) => manifest.documentId),
      indexedChunkCount: plan.pendingChunks.length,
      removedDocumentIds: [...plan.removedDocumentIds],
      unchangedDocumentIds: plan.unchangedDocuments.map((document) => document.id),
    };
  }

  async synchronise(
    database: AppDatabase,
    manifests: MaisSemanticIndexManifest[],
    indexedAt = new Date().toISOString(),
  ): Promise<MaisSemanticIndexResult> {
    return this.execute(this.plan(database, manifests), manifests, indexedAt);
  }

  async search(
    database: AppDatabase,
    request: MaisSemanticSearchRequest,
  ): Promise<MaisSemanticSearchResult> {
    const query = request.query.trim();
    if (!query) throw new Error('Semantic search query is empty.');
    const documents = buildTrainingSemanticDocuments(database);
    const chunks = chunksForDocuments(documents);
    const embeddings = await this.repository.getMany(chunks.map((chunk) => chunk.id));
    const missingEmbeddingChunkIds = chunks.filter((chunk) => {
      const record = embeddings.get(chunk.id);
      return !record || record.contentHash !== chunk.contentHash || record.dimensions !== this.dimensions;
    }).map((chunk) => chunk.id);

    const [queryVector] = await this.runtime.embed({
      texts: [queryText(query)],
      purpose: 'query',
      dimensions: this.dimensions,
    });
    if (!queryVector) throw new Error('Embedding runtime did not return a query vector.');

    const ranked = rankSemanticChunks(queryVector, chunks, embeddings, {
      topK: request.topK,
      maximumPerDocument: request.maximumPerDocument,
      minimumScore: request.minimumScore,
      kinds: request.kinds,
    });

    return {
      selection: compileSemanticContextSelection(ranked, request.contextTokenBudget),
      queryDimensions: this.dimensions,
      indexedChunkCount: embeddings.size,
      missingEmbeddingChunkIds,
    };
  }
}
