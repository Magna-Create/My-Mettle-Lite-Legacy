import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { normaliseExerciseMemory } from '../src/domain/exerciseMemory';
import { updateExerciseRecord } from '../src/application/Phase2Management';

describe('exercise memory', () => {
  it('drops legacy personal notes and preserves the video reference', () => {
    const memory = normaliseExerciseMemory({
      setupNotes: 'Seat 4, medium stance.',
      personalNotes: 'This legacy field should disappear.',
      videoReferenceUrl: 'https://youtube.com/watch?v=example',
    });

    expect(memory.setupNotes).toBe('Seat 4, medium stance.');
    expect(memory.videoReferenceUrl).toBe('https://youtube.com/watch?v=example');
    expect(memory).not.toHaveProperty('personalNotes');
  });

  it('updates setup and video reference without creating a routine version', () => {
    const database = createSeedDatabase();
    const exercise = database.exercises[0]!;
    const routineCount = database.routineVersions.length;
    const updated = updateExerciseRecord(database, exercise.id, {
      memory: {
        setupNotes: 'Bench at 30 degrees.',
        videoReferenceUrl: 'https://youtu.be/example',
      },
    });

    expect(updated.exercises[0]!.memory?.setupNotes).toBe('Bench at 30 degrees.');
    expect(updated.exercises[0]!.memory?.videoReferenceUrl).toBe('https://youtu.be/example');
    expect(updated.routineVersions).toHaveLength(routineCount);
  });
});
