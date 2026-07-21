import type { MaisArtifact } from './contracts';
import {
  MaisResearchBroker,
  type MaisResearchDossier,
  type MaisResearchQuestion,
  type MaisResearchState,
} from './researchBroker';

export interface MaisResearchArtifactReduction {
  state: MaisResearchState;
  dossier: MaisResearchDossier | null;
  diagnostics: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))]
    : [];
}

function questions(value: unknown): MaisResearchQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const question = text(item.question);
    const whyItMatters = text(item.whyItMatters);
    return question && whyItMatters ? [{ question, whyItMatters }] : [];
  });
}

function freshness(value: unknown): 'stable' | 'current' | 'latest' {
  return value === 'stable' || value === 'latest' ? value : 'current';
}

function expectedValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0.75;
}

export function reduceMaisResearchArtifact(
  state: MaisResearchState,
  artifact: MaisArtifact,
): MaisResearchArtifactReduction {
  if (artifact.kind !== 'research_request' || artifact.content.simulator === true) {
    return { state, dossier: null, diagnostics: [] };
  }
  const request = artifact.content.request;
  if (!isRecord(request)) {
    return { state, dossier: null, diagnostics: ['Research-request artefact contained no typed request object.'] };
  }

  const topic = text(request.topic);
  const decisionBlocked = text(request.decisionBlocked);
  const localContextSummary = text(request.localContextSummary);
  const requiredOutputSchema = text(request.requiredOutputSchema) ?? 'MaisResearchReportV1';
  const parsedQuestions = questions(request.questions);
  if (!topic || !decisionBlocked || !localContextSummary || parsedQuestions.length === 0) {
    return {
      state,
      dossier: null,
      diagnostics: ['Research-request artefact is missing its topic, blocked decision, local context or precise questions.'],
    };
  }

  try {
    const broker = new MaisResearchBroker(state);
    const dossier = broker.request({
      topic,
      decisionBlocked,
      localContextSummary,
      questions: parsedQuestions,
      preferredEvidence: stringArray(request.preferredEvidence),
      requiredOutputSchema,
      freshness: freshness(request.freshness),
      expectedValue: expectedValue(request.expectedValue),
      createdByTaskId: artifact.taskId,
      expiresAfterDays: typeof request.expiresAfterDays === 'number' && Number.isFinite(request.expiresAfterDays)
        ? Math.max(1, Math.min(365, Math.floor(request.expiresAfterDays)))
        : 90,
    }, artifact.createdAt);
    return { state: broker.snapshot(), dossier, diagnostics: [] };
  } catch (reason) {
    return {
      state,
      dossier: null,
      diagnostics: [reason instanceof Error ? reason.message : String(reason)],
    };
  }
}
