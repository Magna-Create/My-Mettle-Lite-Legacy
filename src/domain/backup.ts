import type { AppDatabase } from './model';
import { migrateDatabase } from './migrations';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function restoreBackupPayload(value: unknown): AppDatabase {
  if (!isRecord(value)) throw new Error('Backup must contain a JSON object.');
  if (!isRecord(value.profile)) throw new Error('Backup profile is missing.');
  if (!Array.isArray(value.exercises)) throw new Error('Backup exercises are missing.');
  if (!Array.isArray(value.routineVersions) || value.routineVersions.length === 0) {
    throw new Error('Backup routine versions are missing.');
  }
  if (!Array.isArray(value.sessions)) throw new Error('Backup sessions are missing.');
  if (!Array.isArray(value.cycles) || value.cycles.length === 0) throw new Error('Backup cycles are missing.');
  if (typeof value.currentRoutineVersionId !== 'string' || typeof value.currentCycleId !== 'string') {
    throw new Error('Backup current-state references are missing.');
  }

  const migrated = migrateDatabase(value as unknown as AppDatabase);
  if (!migrated.routineVersions.some((item) => item.id === migrated.currentRoutineVersionId)) {
    throw new Error('Backup current routine does not exist.');
  }
  if (!migrated.cycles.some((item) => item.id === migrated.currentCycleId)) {
    throw new Error('Backup current cycle does not exist.');
  }
  if (migrated.activeSessionId && !migrated.sessions.some((item) => item.id === migrated.activeSessionId)) {
    throw new Error('Backup active session does not exist.');
  }
  return migrated;
}
