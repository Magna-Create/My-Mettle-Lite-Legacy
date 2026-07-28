import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { applyRoutinePack, parseRoutinePack, previewRoutinePack } from '../src/domain/routinePack';

function routinePackSource() {
  return {
    format: 'my-mettle-routine-pack',
    version: 1,
    name: 'Return to training',
    exercises: [
      {
        key: 'hack-squat',
        name: 'Hack squat',
        tracking: { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' },
        progressionStep: 5,
        memory: { equipment: 'Hack squat machine', targetMuscles: ['Quads', 'Glutes'], setupNotes: 'Record the foot position.' },
      },
      {
        key: 'cable-row',
        name: 'Seated cable row',
        tracking: { metric: 'load_reps', loadRelationship: 'external', entryBasis: 'total' },
        progressionStep: 2.5,
        memory: { equipment: 'Cable stack', targetMuscles: ['Back'] },
      },
    ],
    days: [
      {
        symbol: 'ψ',
        slots: [
          {
            exerciseKey: 'cable-row',
            importance: 'principal',
            plannedLoad: 35,
            prescriptions: {
              A: { sets: 3, repMin: 8, repMax: 10, restSeconds: 120 },
              B: { sets: 2, repMin: 8, repMax: 10, restSeconds: 120 },
              C: { sets: 1, repMin: 8, repMax: 10, restSeconds: 120 },
            },
          },
        ],
      },
      {
        symbol: 'φ',
        slots: [{ exerciseKey: 'hack-squat', importance: 'principal', plannedLoad: 60 }],
      },
      { symbol: '&', slots: [] },
    ],
  };
}

describe('routine packs', () => {
  it('validates packs, fills missing days and previews the complete replacement', () => {
    const pack = parseRoutinePack(routinePackSource());
    const preview = previewRoutinePack(pack);

    expect(pack.days.map((day) => day.symbol)).toEqual(['ψ', 'φ', 'π', '&']);
    expect(pack.days.find((day) => day.symbol === 'π')?.slots).toEqual([]);
    expect(preview.name).toBe('Return to training');
    expect(preview.exerciseCount).toBe(2);
    expect(preview.slotCount).toBe(2);
    expect(preview.dayCounts.ψ).toBe(1);
    expect(preview.dayCounts['&']).toBe(0);
  });

  it('creates one routine version while preserving matching exercise identity and history', () => {
    const database = createSeedDatabase();
    const originalRoutineId = database.currentRoutineVersionId;
    const originalHackSquatId = database.exercises.find((exercise) => exercise.name === 'Hack squat')?.id;
    const pack = parseRoutinePack(routinePackSource());
    const next = applyRoutinePack(database, pack);
    const routine = next.routineVersions.find((candidate) => candidate.id === next.currentRoutineVersionId);

    expect(next.currentRoutineVersionId).not.toBe(originalRoutineId);
    expect(next.routineVersions).toHaveLength(database.routineVersions.length + 1);
    expect(routine?.changeReason).toContain('Return to training');
    expect(next.exercises.find((exercise) => exercise.name === 'Hack squat')?.id).toBe(originalHackSquatId);
    expect(next.exercises.find((exercise) => exercise.name === 'Seated cable row')?.archived).toBe(false);
    expect(next.exercises.find((exercise) => exercise.name === 'Incline dumbbell press')?.archived).toBe(true);
    expect(routine?.days.find((day) => day.symbol === 'ψ')?.slots).toHaveLength(1);
  });

  it('rejects invalid references and replacement during an active workout', () => {
    const invalid = routinePackSource();
    invalid.days[0]!.slots[0]!.exerciseKey = 'missing';
    expect(() => parseRoutinePack(invalid)).toThrow('unknown exercise key');

    const database = createSeedDatabase();
    database.activeSessionId = 'active';
    expect(() => applyRoutinePack(database, parseRoutinePack(routinePackSource()))).toThrow('active workout');
  });
});
