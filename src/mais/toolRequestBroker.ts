import { createId } from '../domain/ids';

export const MAIS_TOOL_REQUEST_RETENTION_DAYS = 90;

export type MaisToolRequestStatus = 'draft' | 'copied' | 'implemented' | 'rejected';
export type MaisToolFallbackPreference = 'new_builtin' | 'restricted_python' | 'either';

export interface MaisToolRequest {
  id: string;
  title: string;
  analyticalQuestion: string;
  missingCapability: string;
  reasonExistingToolsFail: string;
  inputFields: string[];
  desiredOutputs: string[];
  proposedMethod?: string | undefined;
  assumptions: string[];
  minimumEvidence: string[];
  requiredTests: string[];
  exampleUse: string;
  fallbackPreference: MaisToolFallbackPreference;
  status: MaisToolRequestStatus;
  createdBy: 'user' | 'coding_analyst';
  provenanceRefs: string[];
  monthKey: string;
  createdAt: string;
  expiresAt: string;
  copiedAt?: string | undefined;
  resolvedAt?: string | undefined;
  schemaVersion: 1;
}

export interface MaisToolRequestState {
  requests: MaisToolRequest[];
  retentionDays: number;
  schemaVersion: 1;
}

export interface MaisToolRequestEnvelope {
  schema: 'MaisToolRequestEnvelopeV1';
  request: MaisToolRequest;
  instructions: string[];
  expectedResponse: {
    recommendation: 'add_builtin' | 'use_restricted_python' | 'reject_method' | 'need_more_information';
    reasoningSummary: string;
    proposedCapabilityContract: Record<string, unknown>;
    implementationNotes: string[];
    deterministicTests: string[];
    safetyAndStatisticalCaveats: string[];
  };
}

function addDays(value: string, days: number): string {
  return new Date(Date.parse(value) + days * 86_400_000).toISOString();
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function nonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createMaisToolRequestState(): MaisToolRequestState {
  return { requests: [], retentionDays: MAIS_TOOL_REQUEST_RETENTION_DAYS, schemaVersion: 1 };
}

export function normaliseMaisToolRequestState(value: unknown, now = new Date().toISOString()): MaisToolRequestState {
  const base = createMaisToolRequestState();
  if (!value || typeof value !== 'object') return base;
  const stored = value as Partial<MaisToolRequestState>;
  const retentionDays = MAIS_TOOL_REQUEST_RETENTION_DAYS;
  const threshold = Date.parse(addDays(now, -retentionDays));
  return {
    requests: structuredClone(stored.requests ?? [])
      .filter((request) => Date.parse(request.createdAt) >= threshold && Date.parse(request.expiresAt) > Date.parse(now))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    retentionDays,
    schemaVersion: 1,
  };
}

export class MaisToolRequestBroker {
  private state: MaisToolRequestState;

  constructor(initial: MaisToolRequestState = createMaisToolRequestState(), now = new Date().toISOString()) {
    this.state = normaliseMaisToolRequestState(initial, now);
  }

  snapshot(): MaisToolRequestState {
    return structuredClone(this.state);
  }

  prune(now = new Date().toISOString()): MaisToolRequestState {
    this.state = normaliseMaisToolRequestState(this.state, now);
    return this.snapshot();
  }

  create(input: {
    title: string;
    analyticalQuestion: string;
    missingCapability: string;
    reasonExistingToolsFail: string;
    inputFields?: string[] | undefined;
    desiredOutputs?: string[] | undefined;
    proposedMethod?: string | undefined;
    assumptions?: string[] | undefined;
    minimumEvidence?: string[] | undefined;
    requiredTests?: string[] | undefined;
    exampleUse: string;
    fallbackPreference?: MaisToolFallbackPreference | undefined;
    createdBy?: MaisToolRequest['createdBy'] | undefined;
    provenanceRefs?: string[] | undefined;
  }, now = new Date().toISOString()): MaisToolRequest {
    const title = input.title.trim();
    const analyticalQuestion = input.analyticalQuestion.trim();
    const missingCapability = input.missingCapability.trim();
    const reasonExistingToolsFail = input.reasonExistingToolsFail.trim();
    const exampleUse = input.exampleUse.trim();
    if (!title || !analyticalQuestion || !missingCapability || !reasonExistingToolsFail || !exampleUse) {
      throw new Error('Tool requests require a title, analytical question, missing capability, gap explanation and example use.');
    }
    const duplicate = this.state.requests.find((request) => request.status !== 'rejected'
      && request.missingCapability.toLowerCase() === missingCapability.toLowerCase()
      && request.analyticalQuestion.toLowerCase() === analyticalQuestion.toLowerCase());
    if (duplicate) return structuredClone(duplicate);

    const request: MaisToolRequest = {
      id: createId('mais_tool_request'),
      title,
      analyticalQuestion,
      missingCapability,
      reasonExistingToolsFail,
      inputFields: nonEmpty(input.inputFields ?? []),
      desiredOutputs: nonEmpty(input.desiredOutputs ?? []),
      proposedMethod: input.proposedMethod?.trim() || undefined,
      assumptions: nonEmpty(input.assumptions ?? []),
      minimumEvidence: nonEmpty(input.minimumEvidence ?? []),
      requiredTests: nonEmpty(input.requiredTests ?? []),
      exampleUse,
      fallbackPreference: input.fallbackPreference ?? 'either',
      status: 'draft',
      createdBy: input.createdBy ?? 'user',
      provenanceRefs: nonEmpty(input.provenanceRefs ?? []),
      monthKey: monthKey(now),
      createdAt: now,
      expiresAt: addDays(now, this.state.retentionDays),
      schemaVersion: 1,
    };
    this.state.requests.push(request);
    return structuredClone(request);
  }

  export(requestId: string, now = new Date().toISOString()): string {
    const request = this.require(requestId);
    request.status = 'copied';
    request.copiedAt = now;
    const envelope: MaisToolRequestEnvelope = {
      schema: 'MaisToolRequestEnvelopeV1',
      request: structuredClone(request),
      instructions: [
        'Assess whether this analytical capability is statistically appropriate for a personal longitudinal training dataset.',
        'Prefer a deterministic reusable operation when the method is broadly useful and testable.',
        'Recommend restricted Python only when a fixed operation would be unreasonably narrow or premature.',
        'Do not propose network, filesystem, Android API or direct database access.',
        'Return an implementation contract, edge cases and deterministic synthetic tests rather than executable app changes.',
      ],
      expectedResponse: {
        recommendation: 'add_builtin',
        reasoningSummary: '',
        proposedCapabilityContract: {},
        implementationNotes: [],
        deterministicTests: [],
        safetyAndStatisticalCaveats: [],
      },
    };
    return JSON.stringify(envelope, null, 2);
  }

  remove(requestId: string): void {
    this.state.requests = this.state.requests.filter((request) => request.id !== requestId);
  }

  markImplemented(requestId: string, now = new Date().toISOString()): MaisToolRequest {
    const request = this.require(requestId);
    request.status = 'implemented';
    request.resolvedAt = now;
    return structuredClone(request);
  }

  private require(requestId: string): MaisToolRequest {
    const request = this.state.requests.find((candidate) => candidate.id === requestId);
    if (!request) throw new Error('Analysis-tool request was not found.');
    return request;
  }
}
