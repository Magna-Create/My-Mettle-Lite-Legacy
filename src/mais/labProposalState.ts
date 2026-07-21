import { createId } from '../domain/ids';
import type { MaisArtifact } from './contracts';

export type MaisLabProposalStatus = 'ready' | 'materialised' | 'rejected' | 'invalid';

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

export interface MaisLabProposalState {
  proposals: MaisLabProposal[];
}

export interface MaisLabProposalReduction {
  state: MaisLabProposalState;
  proposal: MaisLabProposal | null;
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

export function createMaisLabProposalState(): MaisLabProposalState {
  return { proposals: [] };
}

export function reduceMaisLabProposalArtifact(
  initial: MaisLabProposalState,
  artifact: MaisArtifact,
): MaisLabProposalReduction {
  if (artifact.kind !== 'lab_proposal_draft' || artifact.content.simulator === true) {
    return { state: initial, proposal: null, diagnostics: [] };
  }
  if (initial.proposals.some((proposal) => proposal.sourceArtifactId === artifact.id)) {
    return { state: initial, proposal: null, diagnostics: [] };
  }

  const proposalValue = artifact.content.proposal;
  const presentationValue = artifact.content.presentation;
  if (!isRecord(proposalValue) || !isRecord(presentationValue)) {
    return { state: initial, proposal: null, diagnostics: ['Lab proposal artefact did not contain typed proposal and presentation objects.'] };
  }
  if (proposalValue.type !== 'training_experiment') {
    return { state: initial, proposal: null, diagnostics: ['Only training_experiment coach proposals can enter Lab.'] };
  }

  const targetRefs = strings(proposalValue.targetRefs);
  const exerciseId = text(proposalValue.exerciseId) ?? targetRefs[0] ?? null;
  const proposedLoad = finite(proposalValue.proposedLoad)
    ?? (isRecord(proposalValue.change) ? finite(proposalValue.change.proposedLoad) ?? finite(proposalValue.change.plannedLoad) : undefined);
  const rationale = text(proposalValue.rationale);
  if (!exerciseId || proposedLoad === undefined || proposedLoad < 0 || !rationale) {
    return { state: initial, proposal: null, diagnostics: ['Lab proposal requires an exerciseId, non-negative proposedLoad and rationale.'] };
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
  return { state, proposal, diagnostics: [] };
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
