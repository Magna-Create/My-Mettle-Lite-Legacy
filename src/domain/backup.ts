import type { AppDatabase } from './model';
import { migrateDatabase } from './migrations';

export interface BackupEnvelope {
  format: 'my-mettle-backup';
  exportVersion: 1;
  exportedAt: string;
  source: 'my-mettle-lite-legacy';
  database: AppDatabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createBackupPayload(database: AppDatabase): BackupEnvelope {
  return {
    format: 'my-mettle-backup',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    source: 'my-mettle-lite-legacy',
    database,
  };
}

export function restoreBackupPayload(value: unknown): AppDatabase {
  if (!isRecord(value)) throw new Error('Backup must contain a JSON object.');

  const payload = value.format === 'my-mettle-backup'
    ? value.database
    : value;

  if (!isRecord(payload)) throw new Error('Backup database is missing.');
  if (!isRecord(payload.profile)) throw new Error('Backup profile is missing.');
  if (!Array.isArray(payload.exercises)) throw new Error('Backup exercises are missing.');
  if (!Array.isArray(payload.routineVersions) || payload.routineVersions.length === 0) {
    throw new Error('Backup routine versions are missing.');
  }
  if (!Array.isArray(payload.sessions)) throw new Error('Backup sessions are missing.');
  if (!Array.isArray(payload.cycles) || payload.cycles.length === 0) throw new Error('Backup cycles are missing.');
  if (typeof payload.currentRoutineVersionId !== 'string' || typeof payload.currentCycleId !== 'string') {
    throw new Error('Backup current-state references are missing.');
  }

  const migrated = migrateDatabase(payload as unknown as AppDatabase);
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
