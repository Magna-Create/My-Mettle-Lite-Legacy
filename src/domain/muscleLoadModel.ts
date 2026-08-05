import type { MuscleLoadModel, MuscleRole } from './model';

const ROLES: readonly MuscleRole[] = ['prime', 'synergist', 'stabiliser'];
const PROPORTION_TOLERANCE = 0.001;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim().slice(0, maxLength);
}

function requiredNumber(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

export function parseMuscleLoadModel(value: unknown, label = 'muscleLoadModel'): MuscleLoadModel | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);

  const version = requiredNumber(value.version, `${label}.version`);
  if (version !== 1) throw new Error(`${label}.version must be 1.`);

  const confidence = requiredNumber(value.confidence, `${label}.confidence`);
  if (confidence < 0 || confidence > 1) throw new Error(`${label}.confidence must be between 0 and 1.`);

  if (!Array.isArray(value.allocations) || value.allocations.length === 0) {
    throw new Error(`${label}.allocations must contain at least one muscle.`);
  }

  const seenMuscles = new Set<string>();
  const allocations = value.allocations.map((candidate, index) => {
    const allocationLabel = `${label}.allocations[${index}]`;
    if (!isRecord(candidate)) throw new Error(`${allocationLabel} must be an object.`);

    const muscle = requiredText(candidate.muscle, `${allocationLabel}.muscle`, 120);
    const normalisedMuscle = muscle.toLocaleLowerCase('en-GB');
    if (seenMuscles.has(normalisedMuscle)) throw new Error(`${label} repeats the muscle “${muscle}”.`);
    seenMuscles.add(normalisedMuscle);

    const proportion = requiredNumber(candidate.proportion, `${allocationLabel}.proportion`);
    if (proportion <= 0 || proportion > 1) {
      throw new Error(`${allocationLabel}.proportion must be greater than 0 and no more than 1.`);
    }

    if (typeof candidate.role !== 'string' || !ROLES.includes(candidate.role as MuscleRole)) {
      throw new Error(`${allocationLabel}.role must be one of: ${ROLES.join(', ')}.`);
    }

    return { muscle, proportion, role: candidate.role as MuscleRole };
  });

  const total = allocations.reduce((sum, allocation) => sum + allocation.proportion, 0);
  if (Math.abs(total - 1) > PROPORTION_TOLERANCE) {
    throw new Error(`${label} proportions must total 1.0; received ${Number(total.toFixed(4))}.`);
  }

  return {
    version: 1,
    basis: requiredText(value.basis, `${label}.basis`, 1000),
    confidence,
    allocations,
  };
}

export function normaliseMuscleLoadModel(value: unknown): MuscleLoadModel | undefined {
  try {
    return parseMuscleLoadModel(value);
  } catch {
    return undefined;
  }
}
