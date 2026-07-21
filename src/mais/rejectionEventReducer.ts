import { recordMaisRejection, type MaisBeliefGraphState } from './beliefGraph';
import type { MaisEvent } from './contracts';

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`).join(',')}}`;
}

export function fingerprintMaisProposal(value: unknown): string {
  const input = canonicalise(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `proposal-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function reduceMaisRejectionEvent(
  state: MaisBeliefGraphState,
  event: MaisEvent,
): { state: MaisBeliefGraphState; applied: boolean; diagnostic?: string } {
  if (event.type !== 'user_rejected_proposal') return { state, applied: false };
  const payload = event.payload;
  const proposalFingerprint = text(payload.proposalFingerprint)
    ?? fingerprintMaisProposal({
      domain: payload.domain,
      scope: payload.scope,
      proposal: payload.proposal,
      entityRefs: event.entityRefs,
    });
  const domain = text(payload.domain) ?? 'training_experiment';
  const scope = text(payload.scope) ?? event.entityRefs[0] ?? 'unknown';
  const reason = text(payload.reason) ?? 'Dismissed by the user.';
  const requiredNewEvidence = strings(payload.requiredNewEvidence);
  const evidenceRefsAtRejection = [...new Set([
    ...event.entityRefs,
    ...strings(payload.evidenceRefsAtRejection),
  ])];
  try {
    return {
      state: recordMaisRejection(state, {
        proposalFingerprint,
        domain,
        scope,
        reason,
        requiredNewEvidence,
        evidenceRefsAtRejection,
        cooldownUntil: text(payload.cooldownUntil) ?? undefined,
      }, event.occurredAt),
      applied: true,
    };
  } catch (reasonValue) {
    return {
      state,
      applied: false,
      diagnostic: reasonValue instanceof Error ? reasonValue.message : String(reasonValue),
    };
  }
}
