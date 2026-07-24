import { describe, expect, it } from 'vitest';
import type { Session } from '../src/domain/model';
import { deriveSessionHealthEvidence, mergeHealthWindow, createHealthEvidenceSnapshot } from '../src/health/healthEvidence';
import type { NativeHealthWindow, NativeHeartRateSample } from '../src/health/healthConnect';

function sample(seconds: number, bpm: number): NativeHeartRateSample {
  return {
    id: `record:${seconds}`,
    recordId: 'record',
    time: new Date(Date.parse('2026-07-24T10:00:00.000Z') + seconds * 1_000).toISOString(),
    beatsPerMinute: bpm,
    dataOrigin: 'com.sec.android.app.shealth',
    isSamsungHealth: true,
  };
}

const session = {
  id: 'session_1',
  cycleId: 'cycle_1',
  day: 'ψ',
  mode: 'A',
  routineVersionId: 'routine_1',
  status: 'completed',
  startedAt: '2026-07-24T10:00:00.000Z',
  completedAt: '2026-07-24T10:03:00.000Z',
  bodyweightSnapshotKg: 70,
  exercises: [{
    id: 'session_exercise_1',
    exerciseId: 'exercise_1',
    slotId: 'slot_1',
    exerciseNameSnapshot: 'Chest press',
    importanceSnapshot: 'core',
    trackingSnapshot: { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' },
    bodyweightSnapshotKg: null,
    plannedLoad: 40,
    prescription: { mode: 'A', included: true, sets: 2, repMin: 8, repMax: 12, restSeconds: 90, deferToAnd: false },
    status: 'completed',
    movementReason: 'base_routine',
    startedAt: '2026-07-24T10:00:10.000Z',
    completedAt: '2026-07-24T10:02:50.000Z',
    sets: [
      { id: 'set_1', setIndex: 0, load: 40, reps: 10, durationSeconds: null, distanceMetres: null, unit: 'kg', completedAt: '2026-07-24T10:01:00.000Z', warmUp: false },
      { id: 'set_2', setIndex: 1, load: 40, reps: 9, durationSeconds: null, distanceMetres: null, unit: 'kg', completedAt: '2026-07-24T10:02:30.000Z', warmUp: false },
    ],
  }],
  schemaVersion: 4,
} as Session;

const heartRate = [
  sample(0, 82), sample(10, 83), sample(20, 84), sample(30, 90), sample(40, 104), sample(50, 118), sample(60, 128),
  sample(75, 116), sample(90, 102), sample(110, 91), sample(120, 92), sample(130, 98), sample(140, 112), sample(150, 126),
  sample(165, 119), sample(180, 101), sample(195, 92),
];

describe('health evidence engine', () => {
  it('aligns Samsung-origin samples with app-owned set timestamps', () => {
    const evidence = deriveSessionHealthEvidence(session, heartRate, { available: true, steps: 120, distanceMetres: 85 });
    expect(evidence).not.toBeNull();
    expect(evidence?.setResponses).toHaveLength(2);
    expect(evidence?.setResponses[0]).toMatchObject({
      setId: 'set_1',
      loggedCompletionAt: '2026-07-24T10:01:00.000Z',
      algorithmId: 'mais.health.hr-set-response',
      algorithmVersion: 1,
    });
    expect(evidence?.setResponses[0]?.estimatedStartAt).not.toBeNull();
    expect(evidence?.setResponses[0]?.peakHeartRate).toBeGreaterThanOrEqual(120);
    expect(evidence?.stepsDuringWindow).toBe(120);
    expect(evidence?.heartRateSampleCount).toBeGreaterThan(10);
  });

  it('deduplicates imported records and retains Samsung provenance', () => {
    const window: NativeHealthWindow = {
      startTime: '2026-07-24T09:55:00.000Z',
      endTime: '2026-07-24T10:08:00.000Z',
      capturedAt: '2026-07-24T11:00:00.000Z',
      provider: 'health_connect',
      samsungHealthPackage: 'com.sec.android.app.shealth',
      grantedPermissions: [],
      missingPermissions: [],
      heartRate,
      activity: { available: true, steps: 120, distanceMetres: 85, containsSamsungHealth: true },
      exerciseSessions: [],
      bodyComposition: [],
      nutrition: [],
      supplementary: [],
    };
    const database = { sessions: [session] } as any;
    const first = mergeHealthWindow(createHealthEvidenceSnapshot(), database, window);
    const second = mergeHealthWindow(first, database, window);
    expect(second.observations).toHaveLength(first.observations.length);
    expect(second.observations.find((record) => record.kind === 'heart_rate_sample')?.dataOrigin).toBe('com.sec.android.app.shealth');
    expect(second.sessionEvidence).toHaveLength(1);
  });
});
