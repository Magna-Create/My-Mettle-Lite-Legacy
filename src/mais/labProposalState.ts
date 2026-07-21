import { createId } from '../domain/ids';
import type { MaisArtifact } from './contracts';

export type MaisLabProposalStatus = 'ready' | 'materialised' | 'rejected' | 'invalid';
export type MaisExperimentDecisionRecommendation = 'adopt' | 'extend' | 'reject' | 'defer';
export type MaisExperimentDecisionStatus = 'ready' | 'accepted' | 'dismissed';

export interface MaisLabProposal {
  id: string;
  sourceArtifactId: string;
  sourceTaskId: string;
  exerciseId: string;
  routineSlotId?: string | undefined;
  title: string;
  summary: string;
  rationale: string;
  baselineLoad?: number | undefined;
  proposedLoad: number;
  targetRepMin?: number | undefined;
  successCriteria: string[];
  stopConditions: string[];
  provenanceRefs: string[];
  status: MaisLabProposalStatus;
  materialisedExperimentId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface MaisExperimentDecisionDraft {
  id: string;
  sourceArtifactId: string;
  sourceTaskId: string;
  experimentId: string;
  recommendation: MaisExperimentDecisionRecommendation;
  title: string;
  summary: string;
  rationale: string;
  evidenceSummary: string;
  limitations: string[];
  nextEvidence: string[];
  provenanceRefs: string[];
  status: MaisExperimentDecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MaisLabProposalState {
  proposals: MaisLabProposal[];
  decisions: MaisExperimentDecisionDraft[];
}

export interface MaisLabProposalReduction {
  state: MaisLabProposalState;
  proposal: MaisLabProposal | null;
  decision: MaisExperimentDecisionDraft | null;
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

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function recommendation(value: unknown): MaisExperimentDecisionRecommendation | null {
  return value === 'adopt' || value === 'extend' || value === 'reject' || value === 'defer' ? value : null;
}

export function createMaisLabProposalState(): MaisLabProposalState {
  return { proposals: [], decisions: [] };
}

function reduceTrainingExperiment(
  initial: MaisLabProposalState,
  artifact: MaisArtifact,
  proposalValue: Record<string, unknown>,
  presentationValue: Record<string, unknown>,
): MaisLabProposalReduction {
  if (initial.proposals.some((proposal) => proposal.sourceArtifactId === artifact.id)) {
    return { state: initial, proposal: null, decision: null, diagnostics: [] };
  }
  const targetRefs = strings(proposalValue.targetRefs);
  const exerciseId = text(proposalValue.exerciseId) ?? targetRefs[0] ?? null;
  const proposedLoad = finite(proposalValue.proposedLoad)
    ?? (isRecord(proposalValue.change) ? finite(proposalValue.change.proposedLoad) ?? finite(proposalValue.change.plannedLoad) : undefined);
  const rationale = text(proposalValue.rationale);
  if (!exerciseId || proposedLoad === undefined || proposedLoad < 0 || !rationale) {
    return { state: initial, proposal: null, decision: null, diagnostics: ['Lab proposal requires an exerciseId, non-negative proposedLoad and rationale.'] };
  }

  const title = text(presentationValue.title) ?? 'Controlled training experiment';
  const summary = text(presentationValue.summary) ?? rationale;
  const proposal: MaisLabProposal = {
    id: createId('mais_lab_proposal'),
    sourceArtifactId: artifact.id,
    sourceTaskId: artifact.taskId,
    exerciseId,
    routineSlotId: text(proposalValue.routineSlotId) ?? undefined,
    title,
    summary,
    rationale,
    baselineLoad: finite(proposalValue.baselineLoad),
    proposedLoad,
    targetRepMin: finite(proposalValue.targetRepMin),
    successCriteria: strings(proposalValue.successCriteria),
    stopConditions: strings(proposalValue.stopConditions),
    provenanceRefs: [...new Set(artifact.provenanceRefs)],
    status: 'ready',
    createdAt: artifact.createdAt,
    updatedAt: artifact.createdAt,
  };
  const state = structuredClone(initial);
  state.proposals.push(proposal);
  return { state, proposal, decision: null, diagnostics: [] };
}

function reduceExperimentDecision(
  initial: MaisLabProposalState,
  artifact: MaisArtifact,
  proposalValue: Record<string, unknown>,
  presentationValue: Record<string, unknown>,
): MaisLabProposalReduction {
  if (initial.decisions.some((decision) => decision.sourceArtifactId === artifact.id)) {
    return { state: initial, proposal: null, decision: null, diagnostics: [] };
  }
  const experimentId = text(proposalValue.experimentId);
  const decisionRecommendation = recommendation(proposalValue.recommendation);
  const rationale = text(proposalValue.rationale);
  const evidenceSummary = text(proposalValue.evidenceSummary);
  if (!experimentId || !decisionRecommendation || !rationale || !evidenceSummary) {
    return {
      state: initial,
      proposal: null,
      decision: null,
      diagnostics: ['Experiment decision requires an experimentId, recommendation, rationale and evidenceSummary.'],
    };
  }
  const decision: MaisExperimentDecisionDraft = {
    id: createId('mais_experiment_decision'),
    sourceArtifactId: artifact.id,
    sourceTaskId: artifact.taskId,
    experimentId,
    recommendation: decisionRecommendation,
    title: text(presentationValue.title) ?? `Experiment recommendation: ${decisionRecommendation}`,
    summary: text(presentationValue.summary) ?? rationale,
    rationale,
    evidenceSummary,
    limitations: strings(proposalValue.limitations),
    nextEvidence: strings(proposalValue.nextEvidence),
    provenanceRefs: [...new Set(artifact.provenanceRefs)],
    status: 'ready',
    createdAt: artifact.createdAt,
    updatedAt: artifact.createdAt,
  };
  const state = structuredClone(initial);
  state.decisions.push(decision);
  return { state, proposal: null, decision, diagnostics: [] };
}

export function reduceMaisLabProposalArtifact(
  initial: MaisLabProposalState,
  artifact: MaisArtifact,
): MaisLabProposalReduction {
  if (artifact.kind !== 'lab_proposal_draft' || artifact.content.simulator === true) {
    return { state: initial, proposal: null, decision: null, diagnostics: [] };
  }

  const proposalValue = artifact.content.proposal;
  const presentationValue = artifact.content.presentation;
  if (!isRecord(proposalValue) || !isRecord(presentationValue)) {
    return { state: initial, proposal: null, decision: null, diagnostics: ['Lab proposal artefact did not contain typed proposal and presentation objects.'] };
  }
  if (proposalValue.type === 'training_experiment') return reduceTrainingExperiment(initial, artifact, proposalValue, presentationValue);
  if (proposalValue.type === 'experiment_decision') return reduceExperimentDecision(initial, artifact, proposalValue, presentationValue);
  return { state: initial, proposal: null, decision: null, diagnostics: ['Unsupported Coach proposal type.'] };
}

export function markMaisLabProposalMaterialised(
  initial: MaisLabProposalState,
  proposalId: string,
  experimentId: string,
  now = new Date().toISOString(),
): MaisLabProposalState {
  const state = structuredClone(initial);
  const proposal = state.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) throw new Error('MAIS Lab proposal was not found.');
  proposal.status = 'materialised';
  proposal.materialisedExperimentId = experimentId;
  proposal.updatedAt = now;
  return state;
}

export function markMaisLabProposalRejected(
  initial: MaisLabProposalState,
  proposalId: string,
  now = new Date().toISOString(),
): MaisLabProposalState {
  const state = structuredClone(initial);
  const proposal = state.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) throw new Error('MAIS Lab proposal was not found.');
  proposal.status = 'rejected';
  proposal.updatedAt = now;
  return state;
}

export function markMaisExperimentDecisionStatus(
  initial: MaisLabProposalState,
  decisionId: string,
  status: Exclude<MaisExperimentDecisionStatus, 'ready'>,
  now = new Date().toISOString(),
): MaisLabProposalState {
  const state = structuredClone(initial);
  const decision = state.decisions.find((candidate) => candidate.id === decisionId);
  if (!decision) throw new Error('MAIS experiment decision was not found.');
  decision.status = status;
  decision.updatedAt = now;
  return state;
}
