import { createId } from '../domain/ids';
import type { MaisArtifact, MaisCheckpoint, MaisEvent, MaisResourceMode, MaisTask, MaisTaskStep } from './contracts';
import type { MaisCapabilityDescriptor } from './capabilityProtocol';

export type MaisEvidenceKind =
  | 'session'
  | 'set'
  | 'reflection'
  | 'exercise_memory'
  | 'routine'
  | 'experiment'
  | 'health_observation'
  | 'belief'
  | 'research'
  | 'user_correction'
  | 'analysis';

export interface MaisEvidenceItem {
  id: string;
  kind: MaisEvidenceKind;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  provenanceRefs: string[];
  occurredAt?: string | undefined;
  relevance: number;
  confidence?: number | undefined;
}

export interface MaisEvidenceProvider {
  resolve(refs: string[]): Promise<MaisEvidenceItem[]>;
  search(query: string, limit: number): Promise<MaisEvidenceItem[]>;
}

export interface MaisContextCompileRequest {
  task: MaisTask;
  step: MaisTaskStep;
  triggerEvents: MaisEvent[];
  checkpoint?: MaisCheckpoint | undefined;
  taskArtifacts: MaisArtifact[];
  capabilities: MaisCapabilityDescriptor[];
  resourceMode: MaisResourceMode;
  maxTokens: number;
  requiredOutputSchema: string;
  now?: string | undefined;
}

export interface MaisContextManifest {
  id: string;
  taskId: string;
  stepId: string;
  createdAt: string;
  budgetTokens: number;
  estimatedTokens: number;
  includedEvidenceIds: string[];
  excludedEvidenceIds: string[];
  triggerEventIds: string[];
  capabilityIds: string[];
  checkpointId?: string | undefined;
}

export interface MaisCompiledContext {
  manifest: MaisContextManifest;
  packet: {
    task: Pick<MaisTask, 'id' | 'goal' | 'priority' | 'currentStepIndex'>;
    step: Pick<MaisTaskStep, 'id' | 'role' | 'goal' | 'requiredTier' | 'outputSchema'>;
    checkpoint?: Pick<MaisCheckpoint, 'id' | 'summary' | 'stepIndex' | 'nextRole'> | undefined;
    triggerEvents: MaisEvent[];
    priorArtifacts: MaisArtifact[];
    evidence: MaisEvidenceItem[];
    capabilities: MaisCapabilityDescriptor[];
    resourceMode: MaisResourceMode;
    requiredOutputSchema: string;
    rules: string[];
  };
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function estimateTokens(value: unknown): number {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function uniqueEvidence(items: MaisEvidenceItem[]): MaisEvidenceItem[] {
  const byId = new Map<string, MaisEvidenceItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.relevance > existing.relevance) byId.set(item.id, structuredClone(item));
  }
  return [...byId.values()];
}

function queryFor(request: MaisContextCompileRequest): string {
  const eventTerms = request.triggerEvents.map((event) => event.type.replaceAll('_', ' ')).join(' ');
  return `${request.task.goal} ${request.step.goal} ${eventTerms}`.trim();
}

export async function compileMaisContext(
  request: MaisContextCompileRequest,
  evidenceProvider: MaisEvidenceProvider,
): Promise<MaisCompiledContext> {
  const directRefs = [...new Set(request.triggerEvents.flatMap((event) => event.entityRefs))];
  const [directEvidence, searchedEvidence] = await Promise.all([
    evidenceProvider.resolve(directRefs),
    evidenceProvider.search(queryFor(request), 24),
  ]);

  const candidates = uniqueEvidence([...directEvidence, ...searchedEvidence]).sort((left, right) => {
    const leftDirect = directRefs.includes(left.id) || left.provenanceRefs.some((ref) => directRefs.includes(ref));
    const rightDirect = directRefs.includes(right.id) || right.provenanceRefs.some((ref) => directRefs.includes(ref));
    if (leftDirect !== rightDirect) return leftDirect ? -1 : 1;
    return right.relevance - left.relevance || (right.occurredAt ?? '').localeCompare(left.occurredAt ?? '');
  });

  const fixedPacket = {
    task: { id: request.task.id, goal: request.task.goal, priority: request.task.priority, currentStepIndex: request.task.currentStepIndex },
    step: {
      id: request.step.id,
      role: request.step.role,
      goal: request.step.goal,
      requiredTier: request.step.requiredTier,
      outputSchema: request.step.outputSchema,
    },
    checkpoint: request.checkpoint
      ? { id: request.checkpoint.id, summary: request.checkpoint.summary, stepIndex: request.checkpoint.stepIndex, nextRole: request.checkpoint.nextRole }
      : undefined,
    triggerEvents: structuredClone(request.triggerEvents),
    priorArtifacts: structuredClone(request.taskArtifacts.slice(-12)),
    capabilities: structuredClone(request.capabilities),
    resourceMode: request.resourceMode,
    requiredOutputSchema: request.requiredOutputSchema,
    rules: [
      'Use only supplied evidence and tool results for factual claims.',
      'Preserve uncertainty and explicit unsure values.',
      'Retain provenance references in every derived claim.',
      'Do not treat a proposal as permission to execute it.',
      'Return only the required structured output schema.',
    ],
  };

  const included: MaisEvidenceItem[] = [];
  const excluded: MaisEvidenceItem[] = [];
  let estimatedTokens = estimateTokens(fixedPacket);
  for (const item of candidates) {
    const itemTokens = estimateTokens(item);
    if (estimatedTokens + itemTokens <= request.maxTokens) {
      included.push(item);
      estimatedTokens += itemTokens;
    } else {
      excluded.push(item);
    }
  }

  const manifest: MaisContextManifest = {
    id: createId('mais_context_manifest'),
    taskId: request.task.id,
    stepId: request.step.id,
    createdAt: timestamp(request.now),
    budgetTokens: request.maxTokens,
    estimatedTokens,
    includedEvidenceIds: included.map((item) => item.id),
    excludedEvidenceIds: excluded.map((item) => item.id),
    triggerEventIds: request.triggerEvents.map((event) => event.id),
    capabilityIds: request.capabilities.map((capability) => capability.id),
    checkpointId: request.checkpoint?.id,
  };

  return {
    manifest,
    packet: {
      ...fixedPacket,
      evidence: included,
    },
  };
}

export class InMemoryMaisEvidenceProvider implements MaisEvidenceProvider {
  constructor(private readonly items: MaisEvidenceItem[]) {}

  async resolve(refs: string[]): Promise<MaisEvidenceItem[]> {
    return this.items
      .filter((item) => refs.includes(item.id) || item.provenanceRefs.some((ref) => refs.includes(ref)))
      .map((item) => structuredClone(item));
  }

  async search(query: string, limit: number): Promise<MaisEvidenceItem[]> {
    const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
    return this.items
      .map((item) => {
        const haystack = `${item.title} ${item.summary} ${JSON.stringify(item.data)}`.toLowerCase();
        const matches = terms.filter((term) => haystack.includes(term)).length;
        return { item, score: item.relevance + matches * 0.05 };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ item }) => structuredClone(item));
  }
}
