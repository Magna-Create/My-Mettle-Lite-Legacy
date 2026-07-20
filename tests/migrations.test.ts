import { describe, expect, it } from 'vitest';
import type { AppDatabase } from '../src/domain/model';
import { migrateDatabase } from '../src/domain/migrations';

function legacyDatabase() {
  return {
    profile: {
      id: 'profile_1', displayName: 'Kian', units: 'kg', dietaryPreference: 'vegetarian',
      cycleStartDay: 1, createdAt: '2026-07-19T00:00:00Z', updatedAt: '2026-07-19T00:00:00Z', schemaVersion: 1,
    },
    exercises: [{
      id: 'exercise_1', name: 'Legacy press', archived: false, defaultUnit: 'kg', progressionStep: 2,
      essentialCue: 'Keep the upper back set.',
      memory: { personalNotes: 'Legacy note', videoReferenceUrl: 'https://youtube.com/watch?v=example' },
      createdAt: '2026-07-19T00:00:00Z', updatedAt: '2026-07-19T00:00:00Z', schemaVersion: 1,
    }],
    routineVersions: [{
      id: 'routine_1', version: 1, createdAt: '2026-07-19T00:00:00Z', effectiveAt: '2026-07-19T00:00:00Z',
      source: 'seed', changeReason: 'Legacy', days: [{
        symbol: 'ψ', slots: [{
          id: 'slot_1', exerciseId: 'exercise_1', position: 0, importance: 'principal', plannedLoad: 20,
          lockedToDay: true,
          prescriptions: {
            A: { mode: 'A', included: true, sets: 1, repMin: 6, repMax: 7, restSeconds: 120, deferToAnd: false },
            B: { mode: 'B', included: true, sets: 1, repMin: 6, repMax: 7, restSeconds: 120, deferToAnd: true },
            C: { mode: 'C', included: true, sets: 1, repMin: 6, repMax: 7, restSeconds: 120, deferToAnd: true },
          },
        }],
      }, { symbol: 'φ', slots: [] }, { symbol: 'π', slots: [] }, { symbol: '&', slots: [] }], schemaVersion: 1,
    }],
    currentRoutineVersionId: 'routine_1',
    sessions: [{
      id: 'session_1', cycleId: 'cycle_1', day: 'ψ', mode: 'A', routineVersionId: 'routine_1', status: 'active',
      startedAt: '2026-07-19T10:00:00Z', exercises: [{
        id: 'session_exercise_1', exerciseId: 'exercise_1', slotId: 'slot_1', exerciseNameSnapshot: 'Legacy press',
        importanceSnapshot: 'principal', plannedLoad: 20,
        prescription: { mode: 'A', included: true, sets: 1, repMin: 6, repMax: 7, restSeconds: 120, deferToAnd: false },
        status: 'active', movementReason: 'base_routine', sets: [{
          id: 'set_1', setIndex: 0, load: 20, reps: 6, unit: 'kg', warmUp: false,
        }],
      }], schemaVersion: 1,
    }],
    cycles: [{
      id: 'cycle_1', startedAt: '2026-07-19T00:00:00Z', status: 'active', completedCoreDays: [],
      andCompleted: false, schemaVersion: 1,
    }],
    currentCycleId: 'cycle_1', activeSessionId: 'session_1', experiments: [],
    createdAt: '2026-07-19T00:00:00Z', updatedAt: '2026-07-19T00:00:00Z', schemaVersion: 1,
  };
}

describe('Phase 2 migration', () => {
  it('preserves legacy records while adding parity fields and health provenance', () => {
    const migrated = migrateDatabase(legacyDatabase() as unknown as AppDatabase);

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.exercises).toHaveLength(1);
    expect(migrated.exercises[0]?.name).toBe('Legacy press');
    expect(migrated.exercises[0]?.tracking).toEqual({
      metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total',
    });
    expect(migrated.exercises[0]?.memory).toMatchObject({
      cues: ['Keep the upper back set.'], substitutions: [], commonMistakes: [], fatigueCost: 3,
      videoReferenceUrl: 'https://youtube.com/watch?v=example',
    });
    expect(migrated.exercises[0]?.memory).not.toHaveProperty('personalNotes');
    expect(migrated.sessions[0]?.exercises[0]?.sets[0]).toMatchObject({
      load: 20, reps: 6, durationSeconds: null, distanceMetres: null, kind: 'prescribed',
    });
    expect(migrated.sessions[0]?.bodyweightSnapshotKg).toBeNull();
    expect(migrated.sessions[0]?.excludedFromInsights).toBe(false);
    expect(migrated.settings.restTimer).toMatchObject({
      autoStart: true, vibrationStrength: 'strong', backgroundNotificationEnabled: true,
    });
    expect(migrated.healthIntegration.permissionState).toBe('not_requested');
    expect(migrated.activeSessionId).toBe('session_1');
  });

  it('is idempotent when applied to an already migrated database', () => {
    const first = migrateDatabase(legacyDatabase() as unknown as AppDatabase);
    const second = migrateDatabase(first);
    expect(second).toEqual(first);
  });
});
