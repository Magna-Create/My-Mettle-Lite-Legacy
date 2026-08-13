import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SetRecord } from '../src/domain/model';
import { calculateSessionCelebration } from '../src/domain/rules/sessionCelebration';

function set(id: string, reps: number | null, load = 10, kind: SetRecord['kind'] = 'prescribed'): SetRecord {
  return { id, setIndex: Number(id.slice(-1)) || 0, load, reps, durationSeconds: null, distanceMetres: null, unit: 'kg', warmUp: false, kind };
}

function exercise(id: string, sets: SetRecord[]): SessionExercise {
  return {
    id,
    exerciseId: `exercise_${id}`,
    slotId: `slot_${id}`,
    exerciseNameSnapshot: id,
    importanceSnapshot: 'core',
    trackingSnapshot: { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' },
    bodyweightSnapshotKg: null,
    plannedLoad: 10,
    prescription: { mode: 'C', included: true, sets: 2, repMin: 8, repMax: 10, restSeconds: 90, deferToAnd: false },
    status: 'active',
    sets,
    movementReason: 'base_routine',
  };
}

function session(exercises: SessionExercise[]): Session {
  return {
    id: 'session', cycleId: 'cycle', day: 'ψ', mode: 'C', routineVersionId: 'routine', status: 'active',
    startedAt: new Date().toISOString(), bodyweightSnapshotKg: null, exercises, schemaVersion: 5,
  };
}

describe('session celebration', () => {
  it('judges completion against the selected session, including mode C', () => {
    const summary = calculateSessionCelebration(session([
      exercise('one', [set('set1', 8), set('set2', 8)]),
      exercise('two', [set('set3', 8), set('set4', 8)]),
    ]));
    expect(summary.tier).toBe('complete');
    expect(summary.completedPrescribedSets).toBe(4);
  });

  it('keeps an unfinished session restrained', () => {
    const summary = calculateSessionCelebration(session([
      exercise('one', [set('set1', 8), set('set2', null)]),
      exercise('two', [set('set3', null), set('set4', null)]),
    ]));
    expect(summary.tier).toBe('partial');
  });

  it('adds stronger tiers only when targets are genuinely exceeded', () => {
    const summary = calculateSessionCelebration(session([
      exercise('one', [set('set1', 11), set('set2', 10)]),
      exercise('two', [set('set3', 10, 12), set('set4', 10, 12)]),
    ]));
    expect(summary.tier).toBe('exceptional');
    expect(summary.exceededExercises).toBe(2);
  });
});
