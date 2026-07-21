import { createId } from '../domain/ids';
import type { MaisArtifact } from './contracts';

export type MaisMemoryStatus = 'active' | 'superseded' | 'archived';
export type MaisMemoryConfidence = 'subjective' | 'observed' | 'inferred';

export interface MaisMemoryRecord {
  id: string;
  entityRef: string;
  summary: string;
  tags: string[];
  provenanceRefs: string[];
  sourceArtifactId: string;
  sourceTaskId: string;
  confidence: MaisMemoryConfidence;
  status: MaisMemoryStatus;
  supersedesMemoryId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface MaisMemoryLedgerState {
  records: MaisMemoryRecord[];
}

export interface MaisMemoryReduction {
  state: MaisMemoryLedgerState;
  added: MaisMemoryRecord[];
  unresolvedQuestions: Array<{
    domain: string;
    question: string;
    priority: number;
    requiredEvidence: string[];
  }>;
  diagnostics: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function number01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalise(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function createMaisMemoryLedgerState(): MaisMemoryLedgerState {
  return { records: [] };
}

export function reduceMaisMemoryArtifact(
  initial: MaisMemoryLedgerState,
  artifact: MaisArtifact,
): MaisMemoryReduction {
  if (artifact.kind !== 'memory_update' || artifact.content.simulator === true) {
    return { state: initial, added: [], unresolvedQuestions: [], diagnostics: [] };
  }

  const state = structuredClone(initial);
  const diagnostics: string[] = [];
  const added: MaisMemoryRecord[] = [];
  const allowedRefs = new Set([artifact.id, ...artifact.provenanceRefs]);
  const updates = Array.isArray(artifact.content.memoryUpdates)
    ? artifact.content.memoryUpdates.filter(isRecord)
    : [];

  for (const update of updates) {
    const entityRef = text(update.entityRef);
    const summary = text(update.summary);
    if (!entityRef || !summary) {
      diagnostics.push('Skipped a memory update without an entityRef and summary.');
      continue;
    }
    const provenanceRefs = strings(update.provenanceRefs).filter((ref) => allowedRefs.has(ref));
    if (provenanceRefs.length === 0) provenanceRefs.push(...artifact.provenanceRefs);
    if (provenanceRefs.length === 0) {
      diagnostics.push(`Skipped memory for ${entityRef} because it had no valid provenance.`);
      continue;
    }

    const duplicate = state.records.find((record) => record.status === 'active'
      && record.entityRef === entityRef
      && normalise(record.summary) === normalise(summary)
      && record.provenanceRefs.join('|') === [...new Set(provenanceRefs)].join('|'));
    if (duplicate) continue;

    const supersedesMemoryId = text(update.supersedesMemoryId) ?? undefined;
    if (supersedesMemoryId) {
      const previous = state.records.find((record) => record.id === supersedesMemoryId && record.status === 'active');
      if (previous) {
        previous.status = 'superseded';
        previous.updatedAt = artifact.createdAt;
      } else {
        diagnostics.push(`Memory ${supersedesMemoryId} could not be superseded because it was not active.`);
      }
    }

    const confidence: MaisMemoryConfidence = update.confidence === 'observed' || update.confidence === 'inferred'
      ? update.confidence
      : 'subjective';
    const record: MaisMemoryRecord = {
      id: createId('mais_memory'),
      entityRef,
      summary,
      tags: strings(update.tags),
      provenanceRefs: [...new Set(provenanceRefs)],
      sourceArtifactId: artifact.id,
      sourceTaskId: artifact.taskId,
      confidence,
      status: 'active',
      supersedesMemoryId,
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt,
    };
    state.records.push(record);
    added.push(record);
  }

  const unresolvedQuestions = (Array.isArray(artifact.content.unresolvedQuestions)
    ? artifact.content.unresolvedQuestions.filter(isRecord)
    : []).flatMap((question) => {
    const value = text(question.question);
    if (!value) return [];
    return [{
      domain: text(question.domain) ?? 'memory',
      question: value,
      priority: number01(question.priority, 0.5),
      requiredEvidence: strings(question.requiredEvidence),
    }];
  });

  if (updates.length === 0) diagnostics.push('Memory update artefact contained no typed memory updates.');
  return { state, added, unresolvedQuestions, diagnostics };
}
