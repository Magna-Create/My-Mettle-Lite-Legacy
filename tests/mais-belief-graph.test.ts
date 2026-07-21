import { describe, expect, it } from 'vitest';
import {
  addMaisBelief,
  addMaisBeliefEvidence,
  addMaisUnresolvedQuestion,
  createMaisBeliefGraphState,
  recordMaisRejection,
  rejectionBlocksProposal,
  resolveMaisQuestion,
} from '../src/mais/beliefGraph';

const t0 = '2026-07-21T10:00:00.000Z';

describe('MAIS belief graph', () => {
  it('keeps a claim uncertain until diverse evidence accumulates', () => {
    let state = addMaisBelief(createMaisBeliefGraphState(), {
      domain: 'principal_rest',
      claim: 'Longer rest improves second-set output on principal pulling work.',
      createdByTaskId: 'task_1',
    }, t0);
    const beliefId = state.beliefs[0]!.id;
    expect(state.beliefs[0]).toMatchObject({ probability: 0.5, confidence: 'insufficient', status: 'active' });

    state = addMaisBeliefEvidence(state, {
      beliefId,
      polarity: 'support',
      weight: 0.9,
      summary: 'Output improved after a longer rest interval.',
      provenanceRefs: ['session_1'],
    }, '2026-07-21T10:01:00.000Z');
    expect(state.beliefs[0]).toMatchObject({ confidence: 'low', status: 'active' });

    state = addMaisBeliefEvidence(state, {
      beliefId,
      polarity: 'support',
      weight: 0.8,
      summary: 'The pattern repeated in another exposure.',
      provenanceRefs: ['session_2'],
    }, '2026-07-21T10:02:00.000Z');
    expect(state.beliefs[0]?.probability).toBeGreaterThan(0.7);
    expect(state.beliefs[0]).toMatchObject({ confidence: 'moderate', status: 'supported' });
  });

  it('marks a belief contested when credible counter-evidence exists', () => {
    let state = addMaisBelief(createMaisBeliefGraphState(), { domain: 'order', claim: 'Exercise order caused the decline.' }, t0);
    const beliefId = state.beliefs[0]!.id;
    state = addMaisBeliefEvidence(state, {
      beliefId,
      polarity: 'support',
      weight: 0.7,
      summary: 'Later position coincided with lower repetitions.',
      provenanceRefs: ['session_a'],
    });
    state = addMaisBeliefEvidence(state, {
      beliefId,
      polarity: 'counter',
      weight: 0.8,
      summary: 'Performance remained low when the exercise moved earlier.',
      provenanceRefs: ['session_b'],
    });
    expect(state.beliefs[0]).toMatchObject({ status: 'contested', supportWeight: 0.7, counterWeight: 0.8 });
  });

  it('links and resolves explicit unresolved questions', () => {
    let state = addMaisBelief(createMaisBeliefGraphState(), { domain: 'recovery', claim: 'Sleep disruption affected output.' }, t0);
    const beliefId = state.beliefs[0]!.id;
    state = addMaisUnresolvedQuestion(state, {
      domain: 'recovery',
      question: 'Does the pattern persist after normal sleep?',
      beliefIds: [beliefId],
      priority: 0.8,
      requiredEvidence: ['two normal-sleep exposures'],
      createdByTaskId: 'task_2',
    }, t0);
    const questionId = state.unresolvedQuestions[0]!.id;
    expect(state.beliefs[0]?.unresolvedQuestionIds).toContain(questionId);
    state = resolveMaisQuestion(state, questionId, { summary: 'Normal-sleep exposures recovered.', provenanceRefs: ['session_3', 'session_4'] });
    expect(state.unresolvedQuestions[0]).toMatchObject({ status: 'resolved', resolutionRefs: ['session_3', 'session_4'] });
  });

  it('prevents exact rejected proposals from resurfacing without new evidence', () => {
    let state = recordMaisRejection(createMaisBeliefGraphState(), {
      proposalFingerprint: 'sha256:proposal',
      domain: 'routine_order',
      scope: 'Swap row and pulldown',
      reason: 'Not worth disrupting the current block.',
      requiredNewEvidence: ['clear order effect'],
      evidenceRefsAtRejection: ['session_1'],
      cooldownUntil: '2026-08-21T00:00:00.000Z',
    }, t0);
    expect(rejectionBlocksProposal(state, 'sha256:proposal', ['session_1'], '2026-07-22T00:00:00.000Z')).toBe(true);
    expect(rejectionBlocksProposal(state, 'sha256:proposal', ['session_1', 'session_2'], '2026-07-22T00:00:00.000Z')).toBe(false);
    expect(rejectionBlocksProposal(state, 'sha256:proposal', ['session_1'], '2026-08-22T00:00:00.000Z')).toBe(false);

    state = recordMaisRejection(state, {
      proposalFingerprint: 'sha256:proposal',
      domain: 'routine_order',
      scope: 'Swap row and pulldown',
      reason: 'Still rejected.',
      requiredNewEvidence: ['stronger effect'],
      evidenceRefsAtRejection: ['session_1', 'session_2'],
    }, '2026-07-23T00:00:00.000Z');
    expect(state.rejections).toHaveLength(1);
  });

  it('rejects duplicate active claims', () => {
    const state = addMaisBelief(createMaisBeliefGraphState(), { domain: 'Volume', claim: 'More volume helps.' }, t0);
    expect(() => addMaisBelief(state, { domain: ' volume ', claim: ' More   volume helps. ' }, t0)).toThrow(/already exists/i);
  });
});
