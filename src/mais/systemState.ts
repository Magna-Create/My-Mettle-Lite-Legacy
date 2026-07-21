import type { MaisAnalysisRun } from './analysisSandbox';
import { createMaisBeliefGraphState, type MaisBeliefGraphState } from './beliefGraph';
import { createMaisCapabilityState, type MaisCapabilityState } from './capabilityProtocol';
import type { MaisContextManifest } from './contextCompiler';
import type { MaisPulseDecision, MaisState } from './contracts';
import { createMaisState } from './heart';
import { createMaisModelLeaseState, type MaisModelLeaseState } from './modelLeases';
import { createMaisReinforcementState, type MaisReinforcementState } from './reinforcementLedger';
import { createMaisResearchState, type MaisResearchState } from './researchBroker';
import type { MaisDiagnosticRecord, MaisParentReview } from './reportCard';
import type { MaisSemanticIndexManifest } from './semanticMemory';
import { createMaisWidgetState, type MaisWidgetState } from './widgetFoundry';

export const MAIS_SYSTEM_VERSION = 1;

export interface MaisSystemSnapshot {
  systemVersion: number;
  heart: MaisState;
  capabilities: MaisCapabilityState;
  models: MaisModelLeaseState;
  widgets: MaisWidgetState;
  research: MaisResearchState;
  reinforcement: MaisReinforcementState;
  beliefs: MaisBeliefGraphState;
  contextManifests: MaisContextManifest[];
  semanticManifests: MaisSemanticIndexManifest[];
  analysisRuns: MaisAnalysisRun[];
  diagnostics: MaisDiagnosticRecord[];
  parentReviews: MaisParentReview[];
  lastPulseDecision?: MaisPulseDecision | undefined;
  createdAt: string;
  updatedAt: string;
}

export function createMaisSystemSnapshot(now = new Date().toISOString()): MaisSystemSnapshot {
  return {
    systemVersion: MAIS_SYSTEM_VERSION,
    heart: createMaisState(now),
    capabilities: createMaisCapabilityState(),
    models: createMaisModelLeaseState(),
    widgets: createMaisWidgetState(),
    research: createMaisResearchState(),
    reinforcement: createMaisReinforcementState(),
    beliefs: createMaisBeliefGraphState(),
    contextManifests: [],
    semanticManifests: [],
    analysisRuns: [],
    diagnostics: [],
    parentReviews: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normaliseMaisSystemSnapshot(value: unknown, now = new Date().toISOString()): MaisSystemSnapshot {
  const base = createMaisSystemSnapshot(now);
  if (!value || typeof value !== 'object') return base;
  const stored = value as Partial<MaisSystemSnapshot>;
  if (stored.systemVersion !== MAIS_SYSTEM_VERSION || !stored.heart) return base;

  return {
    ...base,
    ...structuredClone(stored),
    systemVersion: MAIS_SYSTEM_VERSION,
    heart: structuredClone(stored.heart),
    capabilities: structuredClone(stored.capabilities ?? base.capabilities),
    models: structuredClone(stored.models ?? base.models),
    widgets: structuredClone(stored.widgets ?? base.widgets),
    research: structuredClone(stored.research ?? base.research),
    reinforcement: structuredClone(stored.reinforcement ?? base.reinforcement),
    beliefs: structuredClone(stored.beliefs ?? base.beliefs),
    contextManifests: structuredClone(stored.contextManifests ?? []),
    semanticManifests: structuredClone(stored.semanticManifests ?? []),
    analysisRuns: structuredClone(stored.analysisRuns ?? []),
    diagnostics: structuredClone(stored.diagnostics ?? []),
    parentReviews: structuredClone(stored.parentReviews ?? []),
    createdAt: stored.createdAt ?? base.createdAt,
    updatedAt: stored.updatedAt ?? base.updatedAt,
  };
}
