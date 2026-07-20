import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { restoreBackupPayload } from '../src/domain/backup';

function legacyCompatibleBackup() {
  const database = createSeedDatabase() as unknown as Record<string, unknown>;
  const exercises = (database.exercises as Array<Record<string, unknown>>).map((exercise) => {
    const { memory: _memory, ...legacyExercise } = exercise;
    return { ...legacyExercise, schemaVersion: 2 };
  });
  return {
    ...database,
    exercises,
    settings: {
      restTimer: {
        autoStart: true,
        vibrationEnabled: true,
        vibrationStrength: 'standard',
        chimeEnabled: false,
      },
      schemaVersion: 2,
    },
    schemaVersion: 2,
  };
}

describe('backup restoration', () => {
  it('validates and migrates a complete legacy-compatible payload', () => {
    const restored = restoreBackupPayload(legacyCompatibleBackup());
    expect(restored.schemaVersion).toBe(4);
    expect(restored.settings.restTimer.vibrationStrength).toBe('medium');
    expect(restored.settings.restTimer.backgroundNotificationEnabled).toBe(true);
    expect(restored.exercises[0]?.memory).toBeDefined();
    expect(restored.exercises[0]?.memory?.videoReferenceUrl).toBe('');
    expect(restored.currentRoutineVersionId).toBeTruthy();
  });

  it('rejects incomplete or internally inconsistent backups', () => {
    expect(() => restoreBackupPayload({})).toThrow('Backup profile is missing.');

    const invalid = createSeedDatabase();
    invalid.currentRoutineVersionId = 'missing-routine';
    expect(() => restoreBackupPayload(invalid)).toThrow('Backup current routine does not exist.');
  });
});
