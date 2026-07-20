import type { ExerciseMemory } from './model';

export const EMPTY_EXERCISE_MEMORY: ExerciseMemory = {
  category: '',
  equipment: '',
  targetMuscles: [],
  fatigueCost: 3,
  skillDifficulty: 3,
  cues: [],
  commonMistakes: [],
  setupNotes: '',
  videoReferenceUrl: '',
  machineSettings: '',
  substitutions: [],
};

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function boundedRating(value: unknown, fallback: ExerciseMemory['fatigueCost']): ExerciseMemory['fatigueCost'] {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(5, Math.round(numeric))) as ExerciseMemory['fatigueCost'];
}

function text(value: unknown, maxLength = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normaliseExerciseMemory(value: unknown, essentialCue?: unknown): ExerciseMemory {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const cue = typeof essentialCue === 'string' ? essentialCue.trim() : '';
  const cues = strings(candidate.cues);
  if (cue && !cues.includes(cue)) cues.unshift(cue);

  return {
    category: text(candidate.category, 120),
    equipment: text(candidate.equipment, 120),
    targetMuscles: strings(candidate.targetMuscles),
    fatigueCost: boundedRating(candidate.fatigueCost, 3),
    skillDifficulty: boundedRating(candidate.skillDifficulty, 3),
    cues,
    commonMistakes: strings(candidate.commonMistakes),
    setupNotes: text(candidate.setupNotes),
    videoReferenceUrl: text(candidate.videoReferenceUrl, 2048),
    machineSettings: text(candidate.machineSettings),
    substitutions: strings(candidate.substitutions),
  };
}
