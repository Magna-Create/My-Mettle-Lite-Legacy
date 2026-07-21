import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import {
  aggregateMuscleContributions,
  getMaisMuscleOntology,
  normaliseMuscleContributions,
  resolveExerciseMuscleContributions,
  resolveMaisMuscleLabel,
} from '../src/mais/muscleOntology';

describe('MAIS muscle ontology', () => {
  it('resolves legacy labels and common aliases to stable IDs', () => {
    expect(resolveMaisMuscleLabel('Upper chest')?.id).toBe('pectoralis_major_clavicular');
    expect(resolveMaisMuscleLabel('anterior deltoid')?.id).toBe('deltoid_anterior');
    expect(resolveMaisMuscleLabel('side delt')?.id).toBe('deltoid_lateral');
    expect(resolveMaisMuscleLabel('QUADS')?.id).toBe('quadriceps');
    expect(resolveMaisMuscleLabel('not a muscle')).toBeNull();
  });

  it('resolves seeded exercise memory without losing unknown labels', () => {
    const database = createSeedDatabase();
    const inclinePress = database.exercises.find((exercise) => exercise.name === 'Incline dumbbell press')!;
    const resolved = resolveExerciseMuscleContributions(inclinePress);
    expect(resolved.unresolvedLabels).toEqual([]);
    expect(resolved.contributions.map((item) => item.muscleId)).toEqual([
      'deltoid_anterior',
      'pectoralis_major_clavicular',
      'triceps_brachii',
    ]);
    expect(resolved.contributions.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
  });

  it('normalises duplicate contribution metadata and rejects unknown IDs', () => {
    const contributions = normaliseMuscleContributions([
      { muscleId: 'latissimus_dorsi', role: 'primary', weight: 2, source: 'explicit' },
      { muscleId: 'latissimus_dorsi', role: 'secondary', weight: 1, source: 'model_proposal' },
      { muscleId: 'biceps_brachii', role: 'secondary', weight: 1, source: 'explicit' },
    ]);
    expect(contributions).toHaveLength(2);
    expect(contributions[0]).toMatchObject({ muscleId: 'latissimus_dorsi', weight: 2 / 3 });
    expect(() => normaliseMuscleContributions([{ muscleId: 'invented', role: 'primary', weight: 1, source: 'explicit' }])).toThrow(/unknown muscle/i);
  });

  it('aggregates exposure-weighted contribution without flattening exercise metadata', () => {
    const totals = aggregateMuscleContributions([
      {
        exposureWeight: 3,
        contributions: normaliseMuscleContributions([
          { muscleId: 'latissimus_dorsi', role: 'primary', weight: 0.7, source: 'explicit' },
          { muscleId: 'biceps_brachii', role: 'secondary', weight: 0.3, source: 'explicit' },
        ]),
      },
      {
        exposureWeight: 1,
        contributions: normaliseMuscleContributions([
          { muscleId: 'biceps_brachii', role: 'primary', weight: 1, source: 'explicit' },
        ]),
      },
    ]);
    expect(totals.get('latissimus_dorsi')).toBeCloseTo(2.1);
    expect(totals.get('biceps_brachii')).toBeCloseTo(1.9);
    expect(getMaisMuscleOntology().length).toBeGreaterThan(20);
  });
});
