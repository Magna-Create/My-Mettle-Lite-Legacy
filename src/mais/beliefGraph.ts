import { createId } from '../domain/ids';

export const MAIS_BELIEF_CALIBRATION_ID = 'mais.weighted-evidence-beta';
export const MAIS_BELIEF_CALIBRATION_VERSION = 1;

export type MaisBeliefStatus = 'active' | 'supported' | 'contested' | 'rejected' | 'superseded' | 'archived';
export type MaisBeliefConfidence = 'insufficient' | 'low' | 'moderate' | 'high';
export type MaisEvidencePolarity = 'support' | 'counter';
export type MaisQuestionStatus = 'open' | 'research_requested' | 'resolved' | 'dismissed';

export interface MaisBeliefEvidenceLink {
  id: string;
  beliefId: string;
  polarity: MaisEvidencePolarity;
  weight: number;
  summary: string;
  provenanceRefs: string[];
  sourceArtifactId?: string | undefined;
  observedAt?: string | undefined;
  addedAt: string;
}

export interface MaisBelief {
  id: string;
  domain: string;
  claim: string;
  status: MaisBeliefStatus;
  probability: number;
  confidence: MaisBeliefConfidence;
  supportWeight: number;
  counterWeight: number;
  evidenceLinkIds: string[];
  unresolvedQuestionIds: string[];
  createdByTaskId?: string | undefined;
  supersedesBeliefId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  revision: number;
  calibration: {
    algorithmId: typeof MAIS_BELIEF_CALIBRATION_ID;
    algorithmVersion: typeof MAIS_BELIEF_CALIBRATION_VERSION;
    priorAlpha: 1;
    priorBeta: 1;
  };
}

export interface MaisUnresolvedQuestion {
  id: string;
  domain: string;
  question: string;
  beliefIds: string[];
  priority: number;
  status: MaisQuestionStatus;
  requiredEvidence: string[];
  createdByTaskId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  resolutionSummary?: string | undefined;
  resolutionRefs?: string[] | undefined;
}

export interface MaisRejectionMemory {
  id: string;
  proposalFingerprint: string;
  domain: string;
  scope: string;
  reason: string;
  requiredNewEvidence: string[];
  evidenceRefsAtRejection: string[];
  rejectedAt: string;
  cooldownUntil?: string | undefined;
}

export interface MaisBeliefGraphState {
  beliefs: MaisBelief[];
  evidenceLinks: MaisBeliefEvidenceLink[];
  unresolvedQuestions: MaisUnresolvedQuestion[];
  rejections: MaisRejectionMemory[];
}

export interface MaisBeliefDraft {
  domain: string;
  claim: string;
  createdByTaskId?: string | undefined;
  supersedesBeliefId?: string | undefined;
}

export interface MaisEvidenceDraft {
  beliefId: string;
  polarity: MaisEvidencePolarity;
  weight: number;
  summary: string;
  provenanceRefs: string[];
  sourceArtifactId?: string | undefined;
  observedAt?: string | undefined;
}

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Evidence weight must be finite.');
  return Math.min(1, Math.max(0, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function createMaisBeliefGraphState(): MaisBeliefGraphState {
  return { beliefs: [], evidenceLinks: [], unresolvedQuestions: [], rejections: [] };
}

function confidenceFor(totalWeight: number, uniqueSourceCount: number): MaisBeliefConfidence {
  if (totalWeight < 0.5 || uniqueSourceCount < 1) return 'insufficient';
  if (totalWeight < 1.5 || uniqueSourceCount < 2) return 'low';
  if (totalWeight < 3 || uniqueSourceCount < 4) return 'moderate';
  return 'high';
}

function statusFor(probability: number, confidence: MaisBeliefConfidence, supportWeight: number, counterWeight: number): MaisBeliefStatus {
  if (supportWeight >= 0.25 && counterWeight >= 0.25) return 'contested';
  if (['moderate', 'high'].includes(confidence) && probability >= 0.7) return 'supported';
  if (['moderate', 'high'].includes(confidence) && probability <= 0.3) return 'rejected';
  return 'active';
}

function recalibrateBelief(state: MaisBeliefGraphState, belief: MaisBelief, timestamp: string): void {
  const links = state.evidenceLinks.filter((link) => belief.evidenceLinkIds.includes(link.id));
  const supportWeight = links.filter((link) => link.polarity === 'support').reduce((total, link) => total + link.weight, 0);
  const counterWeight = links.filter((link) => link.polarity === 'counter').reduce((total, link) => total + link.weight, 0);
  const probability = (1 + supportWeight) / (2 + supportWeight + counterWeight);
  const sourceCount = new Set(links.flatMap((link) => link.provenanceRefs)).size;
  const confidence = confidenceFor(supportWeight + counterWeight, sourceCount);

  belief.supportWeight = supportWeight;
  belief.counterWeight = counterWeight;
  belief.probability = probability;
  belief.confidence = confidence;
  if (!['superseded', 'archived'].includes(belief.status)) {
    belief.status = statusFor(probability, confidence, supportWeight, counterWeight);
  }
  belief.updatedAt = timestamp;
  belief.revision += 1;
}

export function addMaisBelief(state: MaisBeliefGraphState, draft: MaisBeliefDraft, timestamp = now()): MaisBeliefGraphState {
  const next = structuredClone(state);
  const domain = draft.domain.trim();
  const claim = draft.claim.trim();
  if (!domain || !claim) throw new Error('A belief requires a domain and claim.');
  const duplicate = next.beliefs.find((belief) => normalise(belief.domain) === normalise(domain)
    && normalise(belief.claim) === normalise(claim)
    && !['superseded', 'archived'].includes(belief.status));
  if (duplicate) throw new Error('An active belief with this claim already exists.');

  if (draft.supersedesBeliefId) {
    const previous = next.beliefs.find((belief) => belief.id === draft.supersedesBeliefId);
    if (!previous) throw new Error('The belief to supersede was not found.');
    previous.status = 'superseded';
    previous.updatedAt = timestamp;
    previous.revision += 1;
  }

  next.beliefs.push({
    id: createId('mais_belief'),
    domain,
    claim,
    status: 'active',
    probability: 0.5,
    confidence: 'insufficient',
    supportWeight: 0,
    counterWeight: 0,
    evidenceLinkIds: [],
    unresolvedQuestionIds: [],
    createdByTaskId: draft.createdByTaskId,
    supersedesBeliefId: draft.supersedesBeliefId,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    calibration: {
      algorithmId: MAIS_BELIEF_CALIBRATION_ID,
      algorithmVersion: MAIS_BELIEF_CALIBRATION_VERSION,
      priorAlpha: 1,
      priorBeta: 1,
    },
  });
  return next;
}

export function addMaisBeliefEvidence(state: MaisBeliefGraphState, draft: MaisEvidenceDraft, timestamp = now()): MaisBeliefGraphState {
  const next = structuredClone(state);
  const belief = next.beliefs.find((candidate) => candidate.id === draft.beliefId);
  if (!belief) throw new Error('Belief not found.');
  if (['superseded', 'archived'].includes(belief.status)) throw new Error('Evidence cannot be attached to an inactive belief.');
  const summary = draft.summary.trim();
  const provenanceRefs = unique(draft.provenanceRefs);
  if (!summary || provenanceRefs.length === 0) throw new Error('Belief evidence requires a summary and provenance.');
  const duplicate = next.evidenceLinks.find((link) => link.beliefId === belief.id
    && link.polarity === draft.polarity
    && normalise(link.summary) === normalise(summary)
    && link.provenanceRefs.join('|') === provenanceRefs.join('|'));
  if (duplicate) return next;

  const link: MaisBeliefEvidenceLink = {
    id: createId('mais_belief_evidence'),
    beliefId: belief.id,
    polarity: draft.polarity,
    weight: clamp01(draft.weight),
    summary,
    provenanceRefs,
    sourceArtifactId: draft.sourceArtifactId,
    observedAt: draft.observedAt,
    addedAt: timestamp,
  };
  next.evidenceLinks.push(link);
  belief.evidenceLinkIds.push(link.id);
  recalibrateBelief(next, belief, timestamp);
  return next;
}

export function addMaisUnresolvedQuestion(
  state: MaisBeliefGraphState,
  input: Omit<MaisUnresolvedQuestion, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  timestamp = now(),
): MaisBeliefGraphState {
  const next = structuredClone(state);
  const question = input.question.trim();
  if (!question) throw new Error('An unresolved question requires text.');
  const beliefIds = unique(input.beliefIds);
  for (const beliefId of beliefIds) {
    if (!next.beliefs.some((belief) => belief.id === beliefId)) throw new Error('An unresolved question referenced an unknown belief.');
  }
  const duplicate = next.unresolvedQuestions.find((candidate) => candidate.status === 'open'
    && normalise(candidate.domain) === normalise(input.domain)
    && normalise(candidate.question) === normalise(question));
  if (duplicate) return next;

  const unresolved: MaisUnresolvedQuestion = {
    ...structuredClone(input),
    id: createId('mais_question'),
    question,
    beliefIds,
    priority: clamp01(input.priority),
    requiredEvidence: unique(input.requiredEvidence),
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  next.unresolvedQuestions.push(unresolved);
  for (const belief of next.beliefs.filter((candidate) => beliefIds.includes(candidate.id))) {
    belief.unresolvedQuestionIds.push(unresolved.id);
    belief.updatedAt = timestamp;
    belief.revision += 1;
  }
  return next;
}

export function resolveMaisQuestion(
  state: MaisBeliefGraphState,
  questionId: string,
  resolution: { summary: string; provenanceRefs: string[]; status?: 'resolved' | 'dismissed' },
  timestamp = now(),
): MaisBeliefGraphState {
  const next = structuredClone(state);
  const question = next.unresolvedQuestions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error('Unresolved question not found.');
  question.status = resolution.status ?? 'resolved';
  question.resolutionSummary = resolution.summary.trim();
  question.resolutionRefs = unique(resolution.provenanceRefs);
  question.updatedAt = timestamp;
  return next;
}

export function recordMaisRejection(
  state: MaisBeliefGraphState,
  input: Omit<MaisRejectionMemory, 'id' | 'rejectedAt'>,
  timestamp = now(),
): MaisBeliefGraphState {
  const next = structuredClone(state);
  if (!input.proposalFingerprint.trim()) throw new Error('Rejection memory requires an exact proposal fingerprint.');
  const existing = next.rejections.find((item) => item.proposalFingerprint === input.proposalFingerprint);
  const rejection: MaisRejectionMemory = {
    ...structuredClone(input),
    id: existing?.id ?? createId('mais_rejection'),
    requiredNewEvidence: unique(input.requiredNewEvidence),
    evidenceRefsAtRejection: unique(input.evidenceRefsAtRejection),
    rejectedAt: timestamp,
  };
  if (existing) next.rejections[next.rejections.indexOf(existing)] = rejection;
  else next.rejections.push(rejection);
  return next;
}

export function rejectionBlocksProposal(
  state: MaisBeliefGraphState,
  proposalFingerprint: string,
  currentEvidenceRefs: string[],
  timestamp = now(),
): boolean {
  const rejection = [...state.rejections].reverse().find((item) => item.proposalFingerprint === proposalFingerprint);
  if (!rejection) return false;
  if (rejection.cooldownUntil && timestamp >= rejection.cooldownUntil) return false;
  const previous = new Set(rejection.evidenceRefsAtRejection);
  const hasNewEvidence = unique(currentEvidenceRefs).some((ref) => !previous.has(ref));
  return !hasNewEvidence;
}
