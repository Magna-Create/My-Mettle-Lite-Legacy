import { describe, expect, it } from 'vitest';
import type { MaisArtifact } from '../src/mais/contracts';
import { reduceMaisResearchArtifact } from '../src/mais/researchArtifactReducer';
import { createMaisResearchState } from '../src/mais/researchBroker';

function artifact(content: Record<string, unknown>): MaisArtifact {
  return {
    id: 'artifact_research',
    taskId: 'task_research',
    episodeId: 'episode_research',
    kind: 'research_request',
    createdBy: 'research_broker',
    createdAt: '2026-07-21T16:00:00.000Z',
    content,
    provenanceRefs: ['belief_1'],
  };
}

describe('MAIS research artefact reducer', () => {
  it('creates a budgeted manual research dossier from typed model output', () => {
    const reduction = reduceMaisResearchArtifact(createMaisResearchState(), artifact({
      request: {
        topic: 'Rest intervals for trained low-repetition work',
        decisionBlocked: 'Whether to test 150 or 210 seconds.',
        localContextSummary: 'Second-set output falls repeatedly.',
        questions: [{ question: 'What evidence compares these ranges?', whyItMatters: 'It determines the experiment.' }],
        preferredEvidence: ['systematic reviews'],
        requiredOutputSchema: 'MaisResearchReportV1',
        freshness: 'current',
        expectedValue: 0.85,
      },
    }));
    expect(reduction.diagnostics).toEqual([]);
    expect(reduction.dossier).toMatchObject({
      status: 'awaiting_user_export',
      createdByTaskId: 'task_research',
      expectedValue: 0.85,
    });
    expect(reduction.state.requests).toHaveLength(1);
  });

  it('returns a diagnostic for malformed content without changing state', () => {
    const initial = createMaisResearchState();
    const reduction = reduceMaisResearchArtifact(initial, artifact({ request: { topic: 'Missing everything else' } }));
    expect(reduction.dossier).toBeNull();
    expect(reduction.state).toEqual(initial);
    expect(reduction.diagnostics.join(' ')).toMatch(/missing/i);
  });

  it('respects active-request and expected-value controls', () => {
    const first = reduceMaisResearchArtifact(createMaisResearchState(), artifact({
      request: {
        topic: 'First topic',
        decisionBlocked: 'First decision',
        localContextSummary: 'Context',
        questions: [{ question: 'Question?', whyItMatters: 'Reason' }],
        expectedValue: 0.8,
      },
    }));
    const second = reduceMaisResearchArtifact(first.state, { ...artifact({
      request: {
        topic: 'Second topic',
        decisionBlocked: 'Second decision',
        localContextSummary: 'Context',
        questions: [{ question: 'Question?', whyItMatters: 'Reason' }],
        expectedValue: 0.9,
      },
    }), id: 'artifact_2', createdAt: '2026-07-22T00:00:00.000Z' });
    expect(second.dossier).toBeNull();
    expect(second.diagnostics.join(' ')).toMatch(/already active/i);

    const lowValue = reduceMaisResearchArtifact(createMaisResearchState(), artifact({
      request: {
        topic: 'Low-value topic',
        decisionBlocked: 'Minor decision',
        localContextSummary: 'Context',
        questions: [{ question: 'Question?', whyItMatters: 'Reason' }],
        expectedValue: 0.2,
      },
    }));
    expect(lowValue.diagnostics.join(' ')).toMatch(/expected-value threshold/i);
  });

  it('ignores simulator and unrelated artefacts', () => {
    const initial = createMaisResearchState();
    expect(reduceMaisResearchArtifact(initial, artifact({ simulator: true }))).toEqual({ state: initial, dossier: null, diagnostics: [] });
    expect(reduceMaisResearchArtifact(initial, { ...artifact({}), kind: 'plan', createdBy: 'governor' })).toEqual({ state: initial, dossier: null, diagnostics: [] });
  });
});
