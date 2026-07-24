import { describe, expect, it } from 'vitest';
import type { MaisRoleRequest, MaisRoleRunner } from '../src/mais/contracts';
import { createNativeMaisRoleRunner, parseMaisNativeRoleOutput, type MaisNativeRoleRuntime } from '../src/mais/nativeRoleRunner';
import type { MaisTrainingEvidenceProvider } from '../src/mais/trainingEvidence';

function request(role: MaisRoleRequest['step']['role'] = 'governor', tier: MaisRoleRequest['step']['requiredTier'] = 'light'): MaisRoleRequest {
  return {
    task: {
      id: 'task_1',
      goal: 'Integrate session evidence.',
      triggerEventIds: ['event_1'],
      priority: 0.82,
      requiredTier: tier,
      status: 'running',
      steps: [],
      currentStepIndex: 0,
      createdAt: '2026-07-21T03:00:00.000Z',
      updatedAt: '2026-07-21T03:00:00.000Z',
      attempts: 1,
    },
    step: {
      id: 'step_1',
      role,
      goal: 'Complete one bounded role step.',
      requiredTier: tier,
      outputSchema: role === 'governor' ? 'MaisInvestigationPlanV1' : 'MaisEvidenceIntegrationV1',
      status: 'running',
    },
    triggerEvents: [{
      id: 'event_1',
      type: 'session_completed',
      occurredAt: '2026-07-21T03:00:00.000Z',
      recordedAt: '2026-07-21T03:00:00.000Z',
      entityRefs: ['session_1'],
      payload: { sessionId: 'session_1' },
      processedByTaskIds: [],
      stateVersion: 1,
    }],
    taskArtifacts: [],
    resourceMode: 'full',
  };
}

function runtime(output: string, ready = true): MaisNativeRoleRuntime {
  return {
    isAvailable: () => true,
    async readStatus(artifact) {
      return {
        artifactId: artifact.artifactId,
        state: ready ? 'ready' : 'absent',
        installed: ready,
        verified: ready,
        bytes: ready ? 1 : 0,
        partialBytes: 0,
        availableBytes: 10_000,
      };
    },
    async run(artifact, backend) {
      return {
        state: 'completed',
        success: true,
        modelId: artifact.modelId,
        runtime: 'litert-lm',
        runtimeVersion: '0.14.0',
        backend,
        maxNumTokens: artifact.contextTokens,
        startedAtEpochMs: 1,
        completedAtEpochMs: 11,
        loadMs: 2,
        firstChunkLatencyMs: 3,
        generationMs: 6,
        unloadMs: 1,
        totalMs: 10,
        memoryBeforeBytes: 100,
        peakPssBytes: 200,
        memoryAfterBytes: 110,
        output,
        outputChars: output.length,
      };
    },
  };
}

const fallback: MaisRoleRunner = {
  async run(roleRequest) {
    return {
      status: 'completed',
      summary: 'Deterministic fallback.',
      artifact: {
        kind: roleRequest.step.role === 'governor' ? 'plan' : 'belief_update',
        content: { simulator: true },
        provenanceRefs: roleRequest.triggerEvents.map((event) => event.id),
      },
    };
  },
};

const evidenceProvider: MaisTrainingEvidenceProvider = {
  async read() {
    return {
      generatedAt: '2026-07-21T03:01:00.000Z',
      sourceDatabaseUpdatedAt: '2026-07-21T03:00:30.000Z',
      directRefs: ['session_1'],
      sessions: [],
      comparableExposures: {},
      exercises: [],
      routines: [],
      experiments: [],
      recentBodyMeasurements: [],
      healthSessionEvidence: [],
      manualBodyComposition: [],
      investigationCandidates: [],
      semanticContext: null,
      warnings: [],
    };
  },
};

const validGovernorContent = {
  route: 'continue',
  reasonCodes: ['direct_evidence_available'],
  scope: { entityRefs: ['session_1'], questions: ['What changed?'] },
  requiredTier: 'standard',
};

describe('MAIS native role runner', () => {
  it('validates a real Governor result and records measured runtime provenance', async () => {
    const output = JSON.stringify({
      status: 'completed',
      summary: 'The completed session should be integrated before deeper analysis.',
      artifact: {
        kind: 'plan',
        content: validGovernorContent,
        provenanceRefs: ['session_1', 'invented_ref'],
      },
    });
    const runner = createNativeMaisRoleRunner(fallback, runtime(output), evidenceProvider);
    const result = await runner.run(request());
    expect(result.summary).toContain('integrated');
    expect(result.artifact?.content.execution).toMatchObject({ source: 'local_model', modelId: 'google.gemma-4-e2b-it', backend: 'cpu' });
    expect(result.artifact?.provenanceRefs).toEqual(['session_1']);
  });

  it('falls back deterministically when the selected role model is not installed', async () => {
    const runner = createNativeMaisRoleRunner(fallback, runtime('{}', false), evidenceProvider);
    const result = await runner.run(request('analyst', 'standard'));
    expect(result.summary).toBe('Deterministic fallback.');
    expect(result.artifact?.content.execution).toMatchObject({
      source: 'deterministic_fallback',
      intendedModelId: 'google.gemma-4-e2b-it',
    });
  });

  it('falls back when a model returns the right outer kind but the wrong role content contract', async () => {
    const output = JSON.stringify({
      status: 'completed',
      summary: 'Malformed plan.',
      artifact: { kind: 'plan', content: { action: 'observe' }, provenanceRefs: ['event_1'] },
    });
    const runner = createNativeMaisRoleRunner(fallback, runtime(output), evidenceProvider);
    const result = await runner.run(request());
    expect(result.summary).toBe('Deterministic fallback.');
    expect(result.artifact?.content.execution).toMatchObject({ source: 'deterministic_fallback' });
  });

  it('rejects an artefact kind belonging to another role', () => {
    const output = JSON.stringify({
      status: 'completed',
      summary: 'Invalid cross-role output.',
      artifact: { kind: 'audit', content: {}, provenanceRefs: ['event_1'] },
    });
    expect(() => parseMaisNativeRoleOutput(output, request())).toThrow(/instead of plan/);
  });

  it('accepts compact JSON wrapped in a markdown fence but filters invented references', () => {
    const output = `\`\`\`json\n${JSON.stringify({
      status: 'completed',
      summary: 'Plan accepted.',
      artifact: { kind: 'plan', content: validGovernorContent, provenanceRefs: ['event_1', 'fake'] },
    })}\n\`\`\``;
    const parsed = parseMaisNativeRoleOutput(output, request());
    expect(parsed.artifact.provenanceRefs).toEqual(['event_1']);
  });
});
