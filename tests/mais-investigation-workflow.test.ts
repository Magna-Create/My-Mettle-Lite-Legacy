import { describe, expect, it } from 'vitest';
import type { MaisArtifact } from '../src/mais/contracts';
import { createMaisState, ingestMaisEvent } from '../src/mais/heart';
import { applyMaisGovernorRoute } from '../src/mais/investigationWorkflow';

const now = '2026-07-21T17:00:00.000Z';

function setup(route: 'continue' | 'deep_analysis' | 'wait' | 'stop') {
  const state = ingestMaisEvent(createMaisState(now), {
    type: 'session_completed',
    entityRefs: ['session_1'],
    payload: { sessionId: 'session_1' },
  }, now);
  const task = state.tasks[0]!;
  const artifact: MaisArtifact = {
    id: 'artifact_governor',
    taskId: task.id,
    episodeId: 'episode_1',
    kind: 'plan',
    createdBy: 'governor',
    createdAt: now,
    content: { route, reasonCodes: ['test'], scope: { entityRefs: ['session_1'], questions: [] } },
    provenanceRefs: ['session_1'],
  };
  return { state, task, artifact };
}

describe('MAIS investigation workflow', () => {
  it('adds Coding Analyst and Coach only after an explicit deep route', () => {
    const { state, task, artifact } = setup('deep_analysis');
    const result = applyMaisGovernorRoute(state, artifact, now);
    const routed = result.state.tasks.find((candidate) => candidate.id === task.id)!;
    expect(result.expanded).toBe(true);
    expect(routed.steps.map((step) => step.role)).toEqual(['governor', 'analyst', 'coding_analyst', 'auditor', 'coach']);
    expect(routed.requiredTier).toBe('deep');
  });

  it('does not duplicate deep steps when the same route artefact is reduced again', () => {
    const first = setup('deep_analysis');
    const once = applyMaisGovernorRoute(first.state, first.artifact, now);
    const twice = applyMaisGovernorRoute(once.state, first.artifact, now);
    expect(twice.expanded).toBe(false);
    expect(twice.state.tasks[0]!.steps.filter((step) => step.role === 'coding_analyst')).toHaveLength(1);
    expect(twice.state.tasks[0]!.steps.filter((step) => step.role === 'coach')).toHaveLength(1);
  });

  it('keeps ordinary integration on the light/standard path', () => {
    const { state, artifact } = setup('continue');
    const result = applyMaisGovernorRoute(state, artifact, now);
    expect(result.expanded).toBe(false);
    expect(result.state.tasks[0]!.steps.map((step) => step.role)).toEqual(['governor', 'analyst', 'auditor']);
  });

  it('ends the bounded task when the Governor says to wait for future evidence', () => {
    const { state, artifact } = setup('wait');
    const result = applyMaisGovernorRoute(state, artifact, now);
    expect(result.completedEarly).toBe(true);
    expect(result.state.tasks[0]!.status).toBe('completed');
    expect(result.state.events[0]!.processedByTaskIds).toContain(result.state.tasks[0]!.id);
  });
});
