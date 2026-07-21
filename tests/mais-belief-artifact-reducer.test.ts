import { describe, expect, it } from 'vitest';
import { reduceMaisBeliefArtifact } from '../src/mais/beliefArtifactReducer';
import { createMaisBeliefGraphState } from '../src/mais/beliefGraph';
import type { MaisArtifact } from '../src/mais/contracts';

function artifact(input: Partial<MaisArtifact> & Pick<MaisArtifact, 'kind' | 'content'>): MaisArtifact {
  return {
    id: input.id ?? 'artifact_1',
    taskId: input.taskId ?? 'task_1',
    episodeId: input.episodeId ?? 'episode_1',
    kind: input.kind,
    createdBy: input.createdBy ?? (input.kind === 'audit' ? 'auditor' : 'analyst'),
    createdAt: input.createdAt ?? '2026-07-21T12:00:00.000Z',
    content: input.content,
    provenanceRefs: input.provenanceRefs ?? ['session_1', 'session_2'],
  };
}

describe('MAIS belief artefact reducer', () => {
  it('creates a belief, filters invented provenance and attaches a question', () => {
    const result = reduceMaisBeliefArtifact(createMaisBeliefGraphState(), artifact({
      kind: 'belief_update',
      content: {
        beliefs: [{
          domain: 'principal_rest',
          claim: 'Longer rest may preserve second-set output.',
          supportingEvidence: [{ summary: 'Two exposures improved.', weight: 0.8, provenanceRefs: ['session_1', 'invented'] }],
          unresolvedQuestions: [{ question: 'Does it repeat in the next two exposures?', priority: 0.8, requiredEvidence: ['two exposures'] }],
        }],
      },
    }));

    expect(result.applied).toBe(true);
    expect(result.state.beliefs).toHaveLength(1);
    expect(result.state.evidenceLinks[0]?.provenanceRefs).toEqual(['session_1']);
    expect(result.state.unresolvedQuestions[0]?.beliefIds).toEqual([result.state.beliefs[0]!.id]);
  });

  it('attaches audit counter-evidence to an existing belief', () => {
    const created = reduceMaisBeliefArtifact(createMaisBeliefGraphState(), artifact({
      kind: 'belief_update',
      content: { belief: { domain: 'order', claim: 'Exercise order explains the decline.' } },
    }));
    const beliefId = created.state.beliefs[0]!.id;
    const audited = reduceMaisBeliefArtifact(created.state, artifact({
      id: 'audit_1',
      kind: 'audit',
      content: {
        findings: [{ beliefId, finding: 'The decline also occurred in first position.', weight: 0.9, polarity: 'counter', provenanceRefs: ['session_2'] }],
      },
    }));
    expect(audited.applied).toBe(true);
    expect(audited.state.evidenceLinks[0]).toMatchObject({ beliefId, polarity: 'counter', weight: 0.9 });
  });

  it('ignores deterministic simulator artefacts', () => {
    const initial = createMaisBeliefGraphState();
    const result = reduceMaisBeliefArtifact(initial, artifact({ kind: 'belief_update', content: { simulator: true } }));
    expect(result).toEqual({ state: initial, applied: false, diagnostics: [] });
  });

  it('reports malformed typed content without mutating state', () => {
    const initial = createMaisBeliefGraphState();
    const result = reduceMaisBeliefArtifact(initial, artifact({ kind: 'belief_update', content: { beliefs: [{ claim: 'Missing domain' }] } }));
    expect(result.applied).toBe(false);
    expect(result.state).toEqual(initial);
    expect(result.diagnostics.join(' ')).toMatch(/valid belief/i);
  });
});
