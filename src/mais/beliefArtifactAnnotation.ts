import type { MaisBeliefGraphState } from './beliefGraph';
import type { MaisArtifact } from './contracts';

export interface MaisResolvedBeliefReference {
  beliefId: string;
  domain: string;
  claim: string;
  status: string;
  confidence: number;
}

export function annotateMaisBeliefArtifact(
  artifact: MaisArtifact,
  before: MaisBeliefGraphState,
  after: MaisBeliefGraphState,
): MaisResolvedBeliefReference[] {
  if (artifact.kind !== 'belief_update') return [];
  const beforeIds = new Set(before.beliefs.map((belief) => belief.id));
  const candidates = after.beliefs.filter((belief) =>
    !beforeIds.has(belief.id)
    || belief.createdByTaskId === artifact.taskId
    || after.evidenceLinks.some((link) => link.beliefId === belief.id && link.sourceArtifactId === artifact.id));
  const resolved = candidates.map((belief) => ({
    beliefId: belief.id,
    domain: belief.domain,
    claim: belief.claim,
    status: belief.status,
    confidence: belief.confidence,
  }));
  if (resolved.length > 0) artifact.content.resolvedBeliefs = resolved;
  return resolved;
}
