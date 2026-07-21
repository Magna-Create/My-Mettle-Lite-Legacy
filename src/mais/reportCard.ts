import { createId } from '../domain/ids';
import type { MaisAnalysisInputSnapshot, MaisAnalysisProgram, MaisAnalysisRun } from './analysisSandbox';
import { createMaisBeliefGraphState, type MaisBeliefGraphState } from './beliefGraph';
import type { MaisCapabilityState } from './capabilityProtocol';
import type { MaisContextManifest } from './contextCompiler';
import type { MaisState } from './contracts';
import { createMaisLabProposalState, type MaisLabProposalState } from './labProposalState';
import { createMaisMemoryLedgerState, type MaisMemoryLedgerState } from './memoryLedger';
import type { MaisModelLeaseState } from './modelLeases';
import type { MaisReinforcementState } from './reinforcementLedger';
import type { MaisResearchState } from './researchBroker';
import type { MaisWidgetState } from './widgetFoundry';

export interface MaisDiagnosticRecord {
  id: string;
  category: 'heart' | 'model' | 'capability' | 'context' | 'analysis' | 'storage' | 'device' | 'research' | 'widget' | 'belief';
  severity: 'info' | 'warning' | 'error';
  message: string;
  refs: string[];
  recordedAt: string;
  data: Record<string, unknown>;
}

export interface MaisReportCard {
  schema: 'MaisReportCardV1';
  id: string;
  generatedAt: string;
  heart: MaisState;
  capabilities: MaisCapabilityState;
  models: MaisModelLeaseState;
  widgets: MaisWidgetState;
  research: MaisResearchState;
  reinforcement: MaisReinforcementState;
  beliefs: MaisBeliefGraphState;
  memories: MaisMemoryLedgerState;
  labProposals: MaisLabProposalState;
  contextManifests: MaisContextManifest[];
  analysisInputs: MaisAnalysisInputSnapshot[];
  analysisPrograms: MaisAnalysisProgram[];
  analysisRuns: MaisAnalysisRun[];
  diagnostics: MaisDiagnosticRecord[];
  summary: {
    eventCount: number;
    taskCount: number;
    completedTaskCount: number;
    failedTaskCount: number;
    proposalCount: number;
    executionCount: number;
    modelLeaseCount: number;
    failedModelLeaseCount: number;
    researchRequestCount: number;
    installedWidgetCount: number;
    activeBeliefCount: number;
    contestedBeliefCount: number;
    unresolvedQuestionCount: number;
    rejectionMemoryCount: number;
    activeMemoryCount: number;
    readyLabProposalCount: number;
    materialisedLabProposalCount: number;
    analysisInputCount: number;
    analysisProgramCount: number;
    analysisRunCount: number;
  };
}

export interface MaisParentReviewFinding {
  finding: string;
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  affectedRefs: string[];
  recommendedAction: string;
}

export interface MaisParentReview {
  schema: 'MaisParentReviewV1';
  id: string;
  reportCardId: string;
  reviewer: string;
  reviewedAt: string;
  findings: MaisParentReviewFinding[];
  engineeringDirectives: Array<{
    directive: string;
    priority: 'low' | 'normal' | 'high';
    appliesTo: string[];
  }>;
}

function sanitise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitise);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const normalised = key.toLowerCase().replaceAll('_', '');
    if (normalised.includes('chainofthought') || normalised.includes('scratchpad') || normalised === 'hiddenreasoning') continue;
    clean[key] = sanitise(item);
  }
  return clean;
}

export function buildMaisReportCard(input: {
  heart: MaisState;
  capabilities: MaisCapabilityState;
  models: MaisModelLeaseState;
  widgets: MaisWidgetState;
  research: MaisResearchState;
  reinforcement: MaisReinforcementState;
  beliefs?: MaisBeliefGraphState | undefined;
  memories?: MaisMemoryLedgerState | undefined;
  labProposals?: MaisLabProposalState | undefined;
  contextManifests: MaisContextManifest[];
  analysisInputs?: MaisAnalysisInputSnapshot[] | undefined;
  analysisPrograms?: MaisAnalysisProgram[] | undefined;
  analysisRuns: MaisAnalysisRun[];
  diagnostics: MaisDiagnosticRecord[];
  now?: string | undefined;
}): MaisReportCard {
  const generatedAt = input.now ?? new Date().toISOString();
  const beliefs = input.beliefs ?? createMaisBeliefGraphState();
  const memories = input.memories ?? createMaisMemoryLedgerState();
  const labProposals = input.labProposals ?? createMaisLabProposalState();
  const analysisInputs = input.analysisInputs ?? [];
  const analysisPrograms = input.analysisPrograms ?? [];
  const card: MaisReportCard = {
    schema: 'MaisReportCardV1',
    id: createId('mais_report_card'),
    generatedAt,
    heart: structuredClone(input.heart),
    capabilities: structuredClone(input.capabilities),
    models: structuredClone(input.models),
    widgets: structuredClone(input.widgets),
    research: structuredClone(input.research),
    reinforcement: structuredClone(input.reinforcement),
    beliefs: structuredClone(beliefs),
    memories: structuredClone(memories),
    labProposals: structuredClone(labProposals),
    contextManifests: structuredClone(input.contextManifests),
    analysisInputs: structuredClone(analysisInputs),
    analysisPrograms: structuredClone(analysisPrograms),
    analysisRuns: structuredClone(input.analysisRuns),
    diagnostics: structuredClone(input.diagnostics),
    summary: {
      eventCount: input.heart.events.length,
      taskCount: input.heart.tasks.length,
      completedTaskCount: input.heart.tasks.filter((task) => task.status === 'completed').length,
      failedTaskCount: input.heart.tasks.filter((task) => task.status === 'failed').length,
      proposalCount: input.capabilities.proposals.length,
      executionCount: input.capabilities.executions.length,
      modelLeaseCount: input.models.leases.length,
      failedModelLeaseCount: input.models.leases.filter((lease) => lease.status === 'failed').length,
      researchRequestCount: input.research.requests.length,
      installedWidgetCount: input.widgets.widgets.filter((widget) => widget.status === 'installed').length,
      activeBeliefCount: beliefs.beliefs.filter((belief) => !['superseded', 'archived'].includes(belief.status)).length,
      contestedBeliefCount: beliefs.beliefs.filter((belief) => belief.status === 'contested').length,
      unresolvedQuestionCount: beliefs.unresolvedQuestions.filter((question) => ['open', 'research_requested'].includes(question.status)).length,
      rejectionMemoryCount: beliefs.rejections.length,
      activeMemoryCount: memories.records.filter((memory) => memory.status === 'active').length,
      readyLabProposalCount: labProposals.proposals.filter((proposal) => proposal.status === 'ready').length,
      materialisedLabProposalCount: labProposals.proposals.filter((proposal) => proposal.status === 'materialised').length,
      analysisInputCount: analysisInputs.length,
      analysisProgramCount: analysisPrograms.length,
      analysisRunCount: input.analysisRuns.length,
    },
  };
  return sanitise(card) as MaisReportCard;
}

export function exportMaisReportCard(card: MaisReportCard): string {
  return JSON.stringify(sanitise(card), null, 2);
}

export function parseMaisParentReview(value: string | MaisParentReview): MaisParentReview {
  const parsed = (typeof value === 'string' ? JSON.parse(value) : value) as Partial<MaisParentReview>;
  if (parsed.schema !== 'MaisParentReviewV1') throw new Error('Unsupported MAIS parent-review schema.');
  if (!parsed.id || !parsed.reportCardId || !parsed.reviewer || !parsed.reviewedAt) throw new Error('Incomplete MAIS parent review.');
  if (!Array.isArray(parsed.findings) || !Array.isArray(parsed.engineeringDirectives)) {
    throw new Error('MAIS parent review requires findings and engineering directives.');
  }
  return structuredClone(parsed as MaisParentReview);
}
