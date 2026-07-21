import { createId } from '../domain/ids';

export type MaisResearchRequestStatus = 'draft' | 'awaiting_user_export' | 'exported' | 'fulfilled' | 'rejected' | 'expired';

export interface MaisResearchQuestion {
  question: string;
  whyItMatters: string;
}

export interface MaisResearchDossier {
  id: string;
  topic: string;
  decisionBlocked: string;
  localContextSummary: string;
  questions: MaisResearchQuestion[];
  preferredEvidence: string[];
  requiredOutputSchema: string;
  freshness: 'stable' | 'current' | 'latest';
  expectedValue: number;
  status: MaisResearchRequestStatus;
  createdByTaskId: string;
  createdAt: string;
  exportedAt?: string | undefined;
  fulfilledAt?: string | undefined;
  expiresAt: string;
}

export interface MaisResearchSource {
  title: string;
  publisher: string;
  publishedAt?: string | undefined;
  accessedAt: string;
  citation: string;
}

export interface MaisResearchReport {
  id: string;
  requestId: string;
  summary: string;
  claims: Array<{
    claim: string;
    confidence: 'low' | 'moderate' | 'high';
    sourceCitations: string[];
    limitations: string[];
  }>;
  sources: MaisResearchSource[];
  producedAt: string;
  expiresAt: string;
  importedAt: string;
}

export interface MaisResearchDossierEnvelope {
  schema: 'MaisResearchDossierV1';
  request: MaisResearchDossier;
  instructions: string[];
  responseTemplate: {
    schema: 'MaisResearchReportV1';
    report: Omit<MaisResearchReport, 'id' | 'importedAt'>;
  };
}

export interface MaisResearchReportEnvelope {
  schema: 'MaisResearchReportV1';
  report: Omit<MaisResearchReport, 'id' | 'importedAt'>;
}

export interface MaisResearchState {
  requests: MaisResearchDossier[];
  reports: MaisResearchReport[];
  rollingWindowDays: number;
  maxRequestsPerWindow: number;
  cooldownDays: number;
}

export interface MaisResearchRequestInput {
  topic: string;
  decisionBlocked: string;
  localContextSummary: string;
  questions: MaisResearchQuestion[];
  preferredEvidence: string[];
  requiredOutputSchema: string;
  freshness: MaisResearchDossier['freshness'];
  expectedValue: number;
  createdByTaskId: string;
  expiresAfterDays?: number | undefined;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normaliseTopic(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createMaisResearchState(): MaisResearchState {
  return {
    requests: [],
    reports: [],
    rollingWindowDays: 30,
    maxRequestsPerWindow: 3,
    cooldownDays: 0,
  };
}

export function parseMaisResearchReportEnvelope(value: string | MaisResearchReportEnvelope): MaisResearchReportEnvelope {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!isRecord(parsed) || parsed.schema !== 'MaisResearchReportV1' || !isRecord(parsed.report)) {
    throw new Error('Unsupported MAIS research-report schema.');
  }
  const report = parsed.report;
  if (typeof report.requestId !== 'string' || typeof report.summary !== 'string' || !Array.isArray(report.claims) || !Array.isArray(report.sources)) {
    throw new Error('Incomplete MAIS research report.');
  }
  if (typeof report.producedAt !== 'string' || typeof report.expiresAt !== 'string') {
    throw new Error('MAIS research report requires production and expiry timestamps.');
  }
  return structuredClone(parsed as unknown as MaisResearchReportEnvelope);
}

export class MaisResearchBroker {
  private state: MaisResearchState;

  constructor(initialState: MaisResearchState = createMaisResearchState()) {
    this.state = structuredClone(initialState);
  }

  snapshot(): MaisResearchState {
    return structuredClone(this.state);
  }

  request(input: MaisResearchRequestInput, now?: string): MaisResearchDossier {
    const createdAt = timestamp(now);
    if (input.expectedValue < 0.65) throw new Error('Research escalation does not meet the expected-value threshold.');
    if (input.questions.length === 0) throw new Error('Research dossier requires at least one precise question.');
    if (this.state.requests.some((request) => ['awaiting_user_export', 'exported'].includes(request.status))) {
      throw new Error('An external research dossier is already active. Batch new questions into that request instead.');
    }

    const windowStart = new Date(createdAt);
    windowStart.setUTCDate(windowStart.getUTCDate() - this.state.rollingWindowDays);
    const recentRequests = this.state.requests.filter((request) => new Date(request.createdAt) >= windowStart && request.status !== 'rejected');
    if (recentRequests.length >= this.state.maxRequestsPerWindow) {
      throw new Error('MAIS external research budget is exhausted for the current rolling window.');
    }

    const topicKey = normaliseTopic(input.topic);
    const duplicate = this.state.requests.find((request) => normaliseTopic(request.topic) === topicKey && request.status !== 'expired');
    if (duplicate) throw new Error('A matching research topic already exists in MAIS memory.');

    const mostRecent = [...this.state.requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (this.state.cooldownDays > 0 && mostRecent && new Date(createdAt) < new Date(addDays(mostRecent.createdAt, this.state.cooldownDays))) {
      throw new Error('Research Broker cooldown is still active.');
    }

    const dossier: MaisResearchDossier = {
      id: createId('mais_research_request'),
      topic: input.topic.trim(),
      decisionBlocked: input.decisionBlocked.trim(),
      localContextSummary: input.localContextSummary.trim(),
      questions: structuredClone(input.questions),
      preferredEvidence: [...input.preferredEvidence],
      requiredOutputSchema: input.requiredOutputSchema,
      freshness: input.freshness,
      expectedValue: Math.min(1, Math.max(0, input.expectedValue)),
      status: 'awaiting_user_export',
      createdByTaskId: input.createdByTaskId,
      createdAt,
      expiresAt: addDays(createdAt, input.expiresAfterDays ?? 90),
    };
    this.state.requests.push(dossier);
    return structuredClone(dossier);
  }

  export(requestId: string, now?: string): string {
    const request = this.requireRequest(requestId);
    if (request.status !== 'awaiting_user_export') throw new Error(`Research request cannot export from ${request.status}.`);
    request.status = 'exported';
    request.exportedAt = timestamp(now);
    const producedAt = request.exportedAt;
    const envelope: MaisResearchDossierEnvelope = {
      schema: 'MaisResearchDossierV1',
      request: structuredClone(request),
      instructions: [
        'Research the questions using current, trustworthy sources and cite every material claim.',
        'Do not infer private user facts beyond the supplied local context.',
        'Return only a MaisResearchReportV1 JSON object matching responseTemplate.',
        'Use the exact requestId and citation strings consistently across claims and sources.',
      ],
      responseTemplate: {
        schema: 'MaisResearchReportV1',
        report: {
          requestId: request.id,
          summary: '',
          claims: [],
          sources: [],
          producedAt,
          expiresAt: request.expiresAt,
        },
      },
    };
    return JSON.stringify(envelope, null, 2);
  }

  importReport(report: Omit<MaisResearchReport, 'id' | 'importedAt'>, now?: string): MaisResearchReport {
    const request = this.requireRequest(report.requestId);
    if (!['exported', 'awaiting_user_export'].includes(request.status)) {
      throw new Error(`Research report cannot fulfil request from ${request.status}.`);
    }
    if (report.sources.length === 0) throw new Error('Research report must include cited sources.');
    if (new Date(report.expiresAt) <= new Date(report.producedAt)) throw new Error('Research report expiry must be later than production time.');
    const citations = new Set(report.sources.map((source) => source.citation));
    for (const source of report.sources) {
      if (!source.title.trim() || !source.publisher.trim() || !source.citation.trim()) throw new Error('Every research source requires title, publisher and citation.');
    }
    for (const claim of report.claims) {
      if (!claim.claim.trim()) throw new Error('Research claims cannot be empty.');
      if (claim.sourceCitations.length === 0) throw new Error('Every imported research claim requires at least one citation.');
      if (claim.sourceCitations.some((citation) => !citations.has(citation))) {
        throw new Error('Research claim references a citation not present in the source list.');
      }
    }

    const importedAt = timestamp(now);
    const stored: MaisResearchReport = {
      ...structuredClone(report),
      id: createId('mais_research_report'),
      importedAt,
    };
    request.status = 'fulfilled';
    request.fulfilledAt = importedAt;
    this.state.reports.push(stored);
    return structuredClone(stored);
  }

  importEnvelope(value: string | MaisResearchReportEnvelope, now?: string): MaisResearchReport {
    return this.importReport(parseMaisResearchReportEnvelope(value).report, now);
  }

  reject(requestId: string): MaisResearchDossier {
    const request = this.requireRequest(requestId);
    if (request.status === 'fulfilled') throw new Error('Fulfilled research request cannot be rejected.');
    request.status = 'rejected';
    return structuredClone(request);
  }

  expireDue(now?: string): MaisResearchState {
    const current = new Date(timestamp(now));
    for (const request of this.state.requests) {
      if (!['fulfilled', 'rejected', 'expired'].includes(request.status) && new Date(request.expiresAt) <= current) request.status = 'expired';
    }
    return this.snapshot();
  }

  private requireRequest(requestId: string): MaisResearchDossier {
    const request = this.state.requests.find((candidate) => candidate.id === requestId);
    if (!request) throw new Error('MAIS research request not found.');
    return request;
  }
}
