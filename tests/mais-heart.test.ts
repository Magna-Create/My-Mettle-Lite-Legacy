import { describe, expect, it } from 'vitest';
import type { MaisResourceSnapshot, MaisRoleRunner } from '../src/mais/contracts';
import { createMaisState, ingestMaisEvent, pulseMais, resumeMaisTask } from '../src/mais/heart';
import { createDeterministicMaisRoleRunner } from '../src/mais/simulatedRoleRunner';
import { deriveMaisResourceMode } from '../src/mais/resourceGovernor';

function resources(overrides: Partial<MaisResourceSnapshot> = {}): MaisResourceSnapshot {
  return {
    appVisibility: 'foreground',
    batterySaver: false,
    isCharging: false,
    activeWorkoutInteraction: false,
    availableMemoryMb: 7_000,
    capturedAt: '2026-07-20T22:10:00.000Z',
    ...overrides,
  };
}

describe('MAIS Resource Governor', () => {
  it('allows full foreground work on a healthy device without requiring charging', () => {
    expect(deriveMaisResourceMode(resources())).toBe('full');
  });

  it('drops to light mode for Battery Saver, active workout interaction and background visibility', () => {
    expect(deriveMaisResourceMode(resources({ batterySaver: true }))).toBe('light');
    expect(deriveMaisResourceMode(resources({ activeWorkoutInteraction: true }))).toBe('light');
    expect(deriveMaisResourceMode(resources({ appVisibility: 'background' }))).toBe('light');
  });

  it('pauses when the app is closed or the user explicitly pauses MAIS', () => {
    expect(deriveMaisResourceMode(resources({ appVisibility: 'closed' }))).toBe('paused');
    expect(deriveMaisResourceMode(resources({ userPaused: true }))).toBe('paused');
  });

  it('leaves thermal throttling to Android and the selected model runtime', () => {
    expect(deriveMaisResourceMode(resources({ thermalState: 'critical' }))).toBe('full');
  });
});

describe('MAIS Heart', () => {
  it('turns passive session completion into a multi-role resumable task', async () => {
    const runner = createDeterministicMaisRoleRunner();
    let state = createMaisState('2026-07-20T22:00:00.000Z');
    state = ingestMaisEvent(state, {
      type: 'session_completed',
      entityRefs: ['session_42'],
      payload: { sessionId: 'session_42' },
    }, '2026-07-20T22:01:00.000Z');

    expect(state.events).toHaveLength(1);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]?.steps.map((step) => step.role)).toEqual(['governor', 'analyst', 'auditor']);

    let pulse = await pulseMais(state, resources(), runner);
    state = pulse.state;
    expect(pulse.decision.action).toBe('advanced');
    expect(state.tasks[0]?.status).toBe('checkpointed');
    expect(state.tasks[0]?.currentStepIndex).toBe(1);
    expect(state.checkpoints).toHaveLength(1);
    expect(state.artifacts[0]?.createdBy).toBe('governor');

    pulse = await pulseMais(state, resources({ capturedAt: '2026-07-20T22:11:00.000Z' }), runner);
    state = pulse.state;
    expect(pulse.decision.action).toBe('resumed');
    expect(state.tasks[0]?.currentStepIndex).toBe(2);
    expect(state.artifacts[1]?.createdBy).toBe('analyst');

    pulse = await pulseMais(state, resources({ capturedAt: '2026-07-20T22:12:00.000Z' }), runner);
    state = pulse.state;
    expect(pulse.decision.action).toBe('completed');
    expect(state.tasks[0]?.status).toBe('completed');
    expect(state.artifacts[2]?.createdBy).toBe('auditor');
    expect(state.events[0]?.processedByTaskIds).toEqual([state.tasks[0]?.id]);
    expect(state.episodes).toHaveLength(3);
    expect(state.episodes.every((episode) => episode.status === 'completed')).toBe(true);
  });

  it('resumes correctly after serialisation rather than relying on a conversation transcript', async () => {
    const runner = createDeterministicMaisRoleRunner();
    let state = ingestMaisEvent(
      createMaisState('2026-07-20T22:00:00.000Z'),
      { type: 'session_completed', entityRefs: ['session_restart'] },
      '2026-07-20T22:01:00.000Z',
    );

    state = (await pulseMais(state, resources(), runner)).state;
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const result = await pulseMais(restored, resources({ capturedAt: '2026-07-20T22:20:00.000Z' }), runner);

    expect(result.decision.action).toBe('resumed');
    expect(result.state.tasks[0]?.currentStepIndex).toBe(2);
    expect(result.state.artifacts[1]?.content.resumedFromCheckpoint).toBe(true);
  });

  it('defers the deep coding step under Battery Saver after completing lightweight triage', async () => {
    const runner = createDeterministicMaisRoleRunner();
    let state = ingestMaisEvent(
      createMaisState('2026-07-20T22:00:00.000Z'),
      { type: 'experiment_threshold_reached', entityRefs: ['experiment_9'] },
      '2026-07-20T22:01:00.000Z',
    );

    state = (await pulseMais(state, resources({ batterySaver: true }), runner)).state;
    expect(state.tasks[0]?.currentStepIndex).toBe(1);
    expect(state.tasks[0]?.steps[0]?.role).toBe('governor');

    const deferred = await pulseMais(
      state,
      resources({ batterySaver: true, capturedAt: '2026-07-20T22:13:00.000Z' }),
      runner,
    );
    expect(deferred.decision.action).toBe('deferred');
    expect(deferred.decision.reason).toContain('deep work');
    expect(deferred.state.tasks[0]?.currentStepIndex).toBe(1);
  });

  it('prioritises a matured experiment over maintenance work', async () => {
    const runner = createDeterministicMaisRoleRunner();
    let state = createMaisState('2026-07-20T22:00:00.000Z');
    state = ingestMaisEvent(state, { type: 'maintenance_due' }, '2026-07-20T22:01:00.000Z');
    state = ingestMaisEvent(state, { type: 'experiment_threshold_reached', entityRefs: ['experiment_priority'] }, '2026-07-20T22:02:00.000Z');

    const result = await pulseMais(state, resources(), runner);
    expect(result.decision.taskId).toBe(state.tasks[1]?.id);
  });

  it('waits for exact approval and resumes only after the app authorises the task', async () => {
    const waitingRunner: MaisRoleRunner = {
      async run() {
        return { status: 'waiting_for_approval', summary: 'Exact proposal approval is required.' };
      },
    };
    let state = ingestMaisEvent(
      createMaisState('2026-07-20T22:00:00.000Z'),
      { type: 'routine_version_created', entityRefs: ['routine_v8'] },
      '2026-07-20T22:01:00.000Z',
    );

    const waiting = await pulseMais(state, resources(), waitingRunner);
    state = waiting.state;
    expect(waiting.decision.action).toBe('waiting');
    expect(state.tasks[0]?.status).toBe('waiting_for_approval');

    state = resumeMaisTask(state, state.tasks[0]!.id, '2026-07-20T22:15:00.000Z');
    const resumed = await pulseMais(state, resources({ capturedAt: '2026-07-20T22:16:00.000Z' }), createDeterministicMaisRoleRunner());
    expect(resumed.state.tasks[0]?.currentStepIndex).toBe(1);
  });

  it('records runner failures without corrupting the remaining workbench', async () => {
    const failingRunner: MaisRoleRunner = {
      async run() {
        throw new Error('simulated runtime crash');
      },
    };
    const state = ingestMaisEvent(
      createMaisState('2026-07-20T22:00:00.000Z'),
      { type: 'session_completed', entityRefs: ['session_failure'] },
      '2026-07-20T22:01:00.000Z',
    );

    const result = await pulseMais(state, resources(), failingRunner);
    expect(result.decision.action).toBe('failed');
    expect(result.state.tasks[0]?.status).toBe('failed');
    expect(result.state.tasks[0]?.lastError).toContain('simulated runtime crash');
    expect(result.state.events).toHaveLength(1);
  });

  it('does not invoke a model when no work exists', async () => {
    let called = false;
    const runner: MaisRoleRunner = {
      async run() {
        called = true;
        return { status: 'completed', summary: 'Unexpected.' };
      },
    };

    const result = await pulseMais(createMaisState('2026-07-20T22:00:00.000Z'), resources(), runner);
    expect(result.decision.action).toBe('idle');
    expect(called).toBe(false);
  });
});
