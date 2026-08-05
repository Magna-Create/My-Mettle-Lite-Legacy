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
        muscleLoadModel: {
          version: 1,
          basis: 'Evidence-informed hypertrophy-stimulus attribution.',
          confidence: 0.8,
          allocations: [
            { muscle: 'Upper back', proportion: 0.5, role: 'prime' },
            { muscle: 'Lats', proportion: 0.3, role: 'prime' },
            { muscle: 'Biceps', proportion: 0.2, role: 'synergist' },
          ],
        },
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
              C: { included: false, sets: 2, repMin: 8, repMax: 10, restSeconds: 120 },
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
    expect(pack.days.find((day) => day.symbol === 'ψ')?.slots[0]?.prescriptions.C.included).toBe(false);
    expect(preview.name).toBe('Return to training');
    expect(preview.exerciseCount).toBe(2);
    expect(preview.muscleModelCount).toBe(1);
    expect(preview.slotCount).toBe(2);
    expect(preview.dayCounts.ψ).toBe(1);
    expect(preview.dayCounts['&']).toBe(0);
  });

  it('creates one routine version while preserving matching exercise identity, history and muscle models', () => {
    const database = createSeedDatabase();
    const originalRoutineId = database.currentRoutineVersionId;
    const originalHackSquatId = database.exercises.find((exercise) => exercise.name === 'Hack squat')?.id;
    const pack = parseRoutinePack(routinePackSource());
    const next = applyRoutinePack(database, pack);
    const routine = next.routineVersions.find((candidate) => candidate.id === next.currentRoutineVersionId);
    const importedRow = next.exercises.find((exercise) => exercise.name === 'Seated cable row');

    expect(next.currentRoutineVersionId).not.toBe(originalRoutineId);
    expect(next.routineVersions).toHaveLength(database.routineVersions.length + 1);
    expect(routine?.changeReason).toContain('Return to training');
    expect(next.exercises.find((exercise) => exercise.name === 'Hack squat')?.id).toBe(originalHackSquatId);
    expect(importedRow?.archived).toBe(false);
    expect(importedRow?.muscleLoadModel?.allocations[0]?.muscle).toBe('Upper back');
    expect(importedRow?.muscleLoadModel?.confidence).toBe(0.8);
    expect(next.exercises.find((exercise) => exercise.name === 'Incline dumbbell press')?.archived).toBe(true);
    expect(routine?.days.find((day) => day.symbol === 'ψ')?.slots).toHaveLength(1);
  });

  it('rejects invalid references, malformed muscle models and replacement during an active workout', () => {
    const invalid = routinePackSource();
    invalid.days[0]!.slots[0]!.exerciseKey = 'missing';
    expect(() => parseRoutinePack(invalid)).toThrow('unknown exercise key');

    const invalidModel = routinePackSource();
    const model = invalidModel.exercises[1]?.muscleLoadModel;
    if (!model) throw new Error('Test muscle model missing');
    model.allocations[0]!.proportion = 0.2;
    expect(() => parseRoutinePack(invalidModel)).toThrow('proportions must total 1.0');

    const database = createSeedDatabase();
    database.activeSessionId = 'active';
    expect(() => applyRoutinePack(database, parseRoutinePack(routinePackSource()))).toThrow('active workout');
  });
});
