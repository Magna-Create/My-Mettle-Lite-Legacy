import type { ExerciseMemory, ExerciseSetupPhoto } from './model';

export const EMPTY_EXERCISE_MEMORY: ExerciseMemory = {
  category: '',
  equipment: '',
  targetMuscles: [],
  fatigueCost: 3,
  skillDifficulty: 3,
  cues: [],
  commonMistakes: [],
  setupNotes: '',
  setupPhotos: [],
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

function setupPhotos(value: unknown): ExerciseSetupPhoto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ExerciseSetupPhoto | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const id = text(candidate.id, 160);
      const dataUrl = typeof candidate.dataUrl === 'string' ? candidate.dataUrl : '';
      const createdAt = text(candidate.createdAt, 80);
      const width = Math.max(1, Math.round(Number(candidate.width)));
      const height = Math.max(1, Math.round(Number(candidate.height)));
      if (!id || !createdAt || !dataUrl.startsWith('data:image/jpeg;base64,')) return null;
      if (!Number.isFinite(width) || !Number.isFinite(height) || dataUrl.length > 2_500_000) return null;
      return { id, dataUrl, createdAt, width, height };
    })
    .filter((item): item is ExerciseSetupPhoto => item !== null)
    .slice(0, 12);
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
    setupPhotos: setupPhotos(candidate.setupPhotos),
    videoReferenceUrl: text(candidate.videoReferenceUrl, 2048),
    machineSettings: text(candidate.machineSettings),
    substitutions: strings(candidate.substitutions),
  };
}
