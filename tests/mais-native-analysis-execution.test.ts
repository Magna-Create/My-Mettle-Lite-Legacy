import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import type { MaisRoleRequest } from '../src/mais/contracts';
import { createCodingAnalystInput, executeCodingAnalystContent } from '../src/mais/nativeAnalysisExecution';
import { createMaisSyntheticHistory } from '../src/mais/syntheticHistory';
import { compileTrainingEvidence } from '../src/mais/trainingEvidence';

function request(sessionId: string): MaisRoleRequest {
  return {
    task: {
      id: 'task_analysis',
      goal: 'Evaluate a mature experiment.',
      triggerEventIds: ['event_analysis'],
      priority: 0.95,
      requiredTier: 'deep',
      status: 'running',
      steps: [],
      currentStepIndex: 0,
      createdAt: '2026-07-21T15:00:00.000Z',
      updatedAt: '2026-07-21T15:00:00.000Z',
      attempts: 1,
    },
    step: {
      id: 'step_analysis',
      role: 'coding_analyst',
      goal: 'Run a reproducible comparison.',
      requiredTier: 'deep',
      outputSchema: 'MaisExperimentAnalysisV1',
      status: 'running',
    },
    triggerEvents: [{
      id: 'event_analysis',
      type: 'experiment_threshold_reached',
      occurredAt: '2026-07-21T15:00:00.000Z',
      recordedAt: '2026-07-21T15:00:00.000Z',
      entityRefs: [sessionId],
      payload: { sessionId },
      processedByTaskIds: [],
      stateVersion: 1,
    }],
    taskArtifacts: [],
    resourceMode: 'full',
  };
}

describe('Coding Analyst host execution bridge', () => {
  it('builds a bounded immutable exposure table and executes the generated recipe', async () => {
    const database = createMaisSyntheticHistory(createSeedDatabase(), 30, { seed: 44 }).database;
    const roleRequest = request(database.sessions.at(-1)!.id);
    const evidence = compileTrainingEvidence(database, roleRequest);
    const input = createCodingAnalystInput(roleRequest, evidence, 12, '2026-07-21T15:01:00.000Z');
    expect(input.records.length).toBeGreaterThan(0);
    expect(input.records.length).toBeLessThanOrEqual(12);

    const execution = await executeCodingAnalystContent({
      analysisPlan: { question: 'Is effective volume changing?', inputRefs: [input.id], method: 'linear trend' },
      programme: {
        language: 'javascript_subset',
        inputSnapshotId: input.id,
        source: JSON.stringify({
          schema: 'MaisAnalysisRecipeV1',
          operations: [
            { op: 'count', as: 'n' },
            { op: 'mean', field: 'totalEffectiveVolumeKgReps', as: 'meanVolume' },
          ],
        }),
        outputSchema: 'MaisExperimentAnalysisV1',
        permittedLibraries: ['statistics'],
      },
      sensitivityChecks: [],
    }, input, roleRequest);

    expect(execution.run.status).toBe('completed');
    expect(execution.run.output.results).toMatchObject({ n: input.records.length });
    expect(execution.program.inputSnapshotId).toBe(input.id);
  });

  it('refuses a recipe that points at another snapshot', async () => {
    const roleRequest = request('session_1');
    const input = createCodingAnalystInput(roleRequest, null, 12);
    await expect(executeCodingAnalystContent({
      programme: {
        language: 'javascript_subset',
        inputSnapshotId: 'wrong_snapshot',
        source: JSON.stringify({ schema: 'MaisAnalysisRecipeV1', operations: [{ op: 'count', as: 'n' }] }),
        outputSchema: 'ResultV1',
        permittedLibraries: [],
      },
    }, input, roleRequest)).rejects.toThrow(/different immutable input/i);
  });

  it('refuses rejected recipes instead of recording them as analyses', async () => {
    const roleRequest = request('session_1');
    const input = createCodingAnalystInput(roleRequest, null, 12);
    await expect(executeCodingAnalystContent({
      programme: {
        language: 'javascript_subset',
        inputSnapshotId: input.id,
        source: 'fetch("https://example.com")',
        outputSchema: 'ResultV1',
        permittedLibraries: [],
      },
    }, input, roleRequest)).rejects.toThrow(/generated analysis was rejected/i);
  });
});
