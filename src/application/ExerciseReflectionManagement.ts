import type { AppDatabase, ExerciseReflection, ReflectionScale, Session } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

export interface ExerciseReflectionInput {
  targetMuscleEngagement: ReflectionScale;
  execution: ExerciseReflection['execution'];
  enjoyment: ReflectionScale;
  comfort: ExerciseReflection['comfort'];
  note?: string;
}

function validScale(value: ReflectionScale) {
  return value === 'unsure' || (Number.isInteger(value) && value >= 1 && value <= 7);
}

function editedSession(session: Session, editedAt: string): Session {
  return {
    ...session,
    editedAt: session.status === 'active' ? session.editedAt : editedAt,
    healthExportState: session.healthExportState === 'exported' ? 'queued' : session.healthExportState,
  };
}

export function saveExerciseReflection(
  database: AppDatabase,
  sessionId: string,
  sessionExerciseId: string,
  input: ExerciseReflectionInput,
): AppDatabase {
  if (!validScale(input.targetMuscleEngagement) || !validScale(input.enjoyment)) {
    throw new Error('Reflection sliders must be between 1 and 7 or marked unsure.');
  }
  if (!['clean', 'mixed', 'poor', 'unsure'].includes(input.execution)) {
    throw new Error('Choose a form and execution response.');
  }
  if (!['good', 'fine', 'unsure', 'uncomfortable', 'pain'].includes(input.comfort)) {
    throw new Error('Choose a comfort response.');
  }

  const updatedAt = new Date().toISOString();
  let foundSession = false;
  let foundExercise = false;
  const sessions = database.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    foundSession = true;
    const updated = editedSession(session, updatedAt);
    return {
      ...updated,
      exercises: updated.exercises.map((exercise) => {
        if (exercise.id !== sessionExerciseId) return exercise;
        foundExercise = true;
        const reflection: ExerciseReflection = {
          targetMuscleEngagement: input.targetMuscleEngagement,
          execution: input.execution,
          enjoyment: input.enjoyment,
          comfort: input.comfort,
          note: input.note?.trim().slice(0, 2000) || undefined,
          recordedAt: exercise.reflection?.recordedAt ?? updatedAt,
          updatedAt,
        };
        return { ...exercise, reflection };
      }),
    };
  });

  if (!foundSession) throw new Error('Session not found.');
  if (!foundExercise) throw new Error('Session exercise not found.');

  return {
    ...database,
    sessions,
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}
