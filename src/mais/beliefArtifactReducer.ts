import {
  addMaisBelief,
  addMaisBeliefEvidence,
  addMaisUnresolvedQuestion,
  type MaisBeliefGraphState,
  type MaisEvidencePolarity,
} from './beliefGraph';
import type { MaisArtifact } from './contracts';

interface ReductionResult {
  state: MaisBeliefGraphState;
  applied: boolean;
  diagnostics: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function filteredProvenance(value: unknown, artifact: MaisArtifact): string[] {
  const allowed = new Set([artifact.id, ...artifact.provenanceRefs]);
  const requested = stringArray(value).filter((ref) => allowed.has(ref));
  return requested.length ? [...new Set(requested)] : [...new Set(artifact.provenanceRefs)];
}

function findBeliefId(
  state: MaisBeliefGraphState,
  record: Record<string, unknown>,
  artifact: MaisArtifact,
): { state: MaisBeliefGraphState; beliefId: string | null; created: boolean } {
  const explicitId = text(record.beliefId);
  if (explicitId) {
    return { state, beliefId: state.beliefs.some((belief) => belief.id === explicitId) ? explicitId : null, created: false };
  }
  const domain = text(record.domain);
  const claim = text(record.claim);
  if (!domain || !claim) return { state, beliefId: null, created: false };
  const beforeIds = new Set(state.beliefs.map((belief) => belief.id));
  const next = addMaisBelief(state, {
    domain,
    claim,
    createdByTaskId: artifact.taskId,
    supersedesBeliefId: text(record.supersedesBeliefId) ?? undefined,
  }, artifact.createdAt);
  const created = next.beliefs.find((belief) => !beforeIds.has(belief.id));
  return { state: next, beliefId: created?.id ?? null, created: Boolean(created) };
}

function evidenceRecords(record: Record<string, unknown>): Array<Record<string, unknown> & { polarity: MaisEvidencePolarity }> {
  const generic = records(record.evidence).flatMap((item) => {
    const polarity = item.polarity === 'support' || item.polarity === 'counter' ? item.polarity : null;
    return polarity ? [{ ...item, polarity }] : [];
  });
  const support = records(record.supportingEvidence).map((item) => ({ ...item, polarity: 'support' as const }));
  const counter = records(record.counterEvidence).map((item) => ({ ...item, polarity: 'counter' as const }));
  return [...generic, ...support, ...counter];
}

function applyEvidence(
  state: MaisBeliefGraphState,
  beliefId: string,
  evidence: Array<Record<string, unknown> & { polarity: MaisEvidencePolarity }>,
  artifact: MaisArtifact,
): { state: MaisBeliefGraphState; count: number } {
  let next = state;
  let count = 0;
  for (const item of evidence) {
    const summary = text(item.summary) ?? text(item.finding);
    if (!summary) continue;
    const before = next.evidenceLinks.length;
    next = addMaisBeliefEvidence(next, {
      beliefId,
      polarity: item.polarity,
      weight: number01(item.weight, 0.5),
      summary,
      provenanceRefs: filteredProvenance(item.provenanceRefs, artifact),
      sourceArtifactId: artifact.id,
      observedAt: text(item.observedAt) ?? undefined,
    }, artifact.createdAt);
    if (next.evidenceLinks.length > before) count += 1;
  }
  return { state: next, count };
}

function applyQuestions(
  state: MaisBeliefGraphState,
  beliefId: string,
  value: unknown,
  artifact: MaisArtifact,
): { state: MaisBeliefGraphState; count: number } {
  let next = state;
  let count = 0;
  for (const item of records(value)) {
    const question = text(item.question);
    if (!question) continue;
    const belief = next.beliefs.find((candidate) => candidate.id === beliefId);
    const before = next.unresolvedQuestions.length;
    next = addMaisUnresolvedQuestion(next, {
      domain: text(item.domain) ?? belief?.domain ?? 'general',
      question,
      beliefIds: [beliefId],
      priority: number01(item.priority, 0.5),
      requiredEvidence: stringArray(item.requiredEvidence),
      createdByTaskId: artifact.taskId,
    }, artifact.createdAt);
    if (next.unresolvedQuestions.length > before) count += 1;
  }
  return { state: next, count };
}

function reduceBeliefUpdate(state: MaisBeliefGraphState, artifact: MaisArtifact): ReductionResult {
  const diagnostics: string[] = [];
  let next = state;
  let applied = false;
  const updates = [
    ...records(artifact.content.beliefUpdates),
    ...records(artifact.content.beliefs),
    ...records(artifact.content.belief),
  ];

  for (const update of updates) {
    try {
      const target = findBeliefId(next, update, artifact);
      next = target.state;
      if (!target.beliefId) {
        diagnostics.push('Skipped a belief update without a valid belief ID or domain/claim.');
        continue;
      }
      applied ||= target.created;
      const evidence = applyEvidence(next, target.beliefId, evidenceRecords(update), artifact);
      next = evidence.state;
      applied ||= evidence.count > 0;
      const questions = applyQuestions(next, target.beliefId, update.unresolvedQuestions ?? update.questions, artifact);
      next = questions.state;
      applied ||= questions.count > 0;
    } catch (reason) {
      diagnostics.push(reason instanceof Error ? reason.message : String(reason));
    }
  }
  if (updates.length === 0) diagnostics.push('Belief update artefact contained no typed belief updates.');
  return { state: next, applied, diagnostics };
}

function reduceAudit(state: MaisBeliefGraphState, artifact: MaisArtifact): ReductionResult {
  const diagnostics: string[] = [];
  let next = state;
  let applied = false;
  const findings = [...records(artifact.content.findings), ...records(artifact.content.evidence)];

  for (const finding of findings) {
    const beliefId = text(finding.beliefId) ?? text(finding.targetBeliefId);
    if (!beliefId || !next.beliefs.some((belief) => belief.id === beliefId)) {
      diagnostics.push('Skipped an audit finding that did not reference a known belief.');
      continue;
    }
    const polarity: MaisEvidencePolarity = finding.polarity === 'support' ? 'support' : 'counter';
    try {
      const evidence = applyEvidence(next, beliefId, [{ ...finding, polarity }], artifact);
      next = evidence.state;
      applied ||= evidence.count > 0;
      const questions = applyQuestions(next, beliefId, finding.unresolvedQuestions ?? finding.questions, artifact);
      next = questions.state;
      applied ||= questions.count > 0;
    } catch (reason) {
      diagnostics.push(reason instanceof Error ? reason.message : String(reason));
    }
  }
  if (findings.length === 0) diagnostics.push('Audit artefact contained no typed belief findings.');
  return { state: next, applied, diagnostics };
}

export function reduceMaisBeliefArtifact(state: MaisBeliefGraphState, artifact: MaisArtifact): ReductionResult {
  if (artifact.content.simulator === true) return { state, applied: false, diagnostics: [] };
  if (artifact.kind === 'belief_update') return reduceBeliefUpdate(state, artifact);
  if (artifact.kind === 'audit') return reduceAudit(state, artifact);
  return { state, applied: false, diagnostics: [] };
}
