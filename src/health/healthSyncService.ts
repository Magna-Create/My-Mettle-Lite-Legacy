import { createId } from '../domain/ids';
import type { AppDatabase } from '../domain/model';
import { IndexedDbHealthEvidenceRepository } from '../adapters/storage/IndexedDbHealthEvidenceRepository';
import { mergeHealthWindow, type MaisHealthEvidenceSnapshot, type MaisManualBodyCompositionRecord } from './healthEvidence';
import { readHealthWindow, type NativeHealthWindow } from './healthConnect';

const PRE_SESSION_MINUTES = 5;
const POST_SESSION_MINUTES = 5;
const MAX_SYNC_SESSIONS = 12;

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

export class HealthEvidenceService {
  constructor(private readonly repository = new IndexedDbHealthEvidenceRepository()) {}

  load(): Promise<MaisHealthEvidenceSnapshot> {
    return this.repository.load();
  }

  async syncRecentSessions(
    database: AppDatabase,
    options: { includeContext?: boolean | undefined; includeSupplementary?: boolean | undefined; maximumSessions?: number | undefined } = {},
  ): Promise<{ snapshot: MaisHealthEvidenceSnapshot; windows: NativeHealthWindow[]; syncedSessionIds: string[] }> {
    const sessions = database.sessions
      .filter((session) => session.status === 'completed' && session.completedAt && !session.discardedAt)
      .sort((left, right) => (left.completedAt ?? '').localeCompare(right.completedAt ?? ''))
      .slice(-Math.max(1, options.maximumSessions ?? MAX_SYNC_SESSIONS));
    let snapshot = await this.repository.load();
    const windows: NativeHealthWindow[] = [];
    const syncedSessionIds: string[] = [];

    try {
      for (const session of sessions) {
        const window = await readHealthWindow({
          startTime: addMinutes(session.startedAt, -PRE_SESSION_MINUTES),
          endTime: addMinutes(session.completedAt!, POST_SESSION_MINUTES),
          includeContext: options.includeContext ?? true,
          includeSupplementary: options.includeSupplementary ?? false,
        });
        windows.push(window);
        syncedSessionIds.push(session.id);
        snapshot = mergeHealthWindow(snapshot, database, window);
      }
      await this.repository.save(snapshot);
      return { snapshot, windows, syncedSessionIds };
    } catch (reason) {
      snapshot = {
        ...snapshot,
        lastError: reason instanceof Error ? reason.message : String(reason),
        updatedAt: new Date().toISOString(),
      };
      await this.repository.save(snapshot);
      throw reason;
    }
  }

  async addManualBodyComposition(input: {
    recordedAt: string;
    bodyFatPercent?: number | undefined;
    basalMetabolicRateKcal?: number | undefined;
    skeletalMuscleMassKg?: number | undefined;
    leanMassKg?: number | undefined;
    visceralFatRating?: number | undefined;
    weightKg?: number | undefined;
    source: MaisManualBodyCompositionRecord['source'];
    sourceLabel?: string | undefined;
    note?: string | undefined;
  }): Promise<MaisHealthEvidenceSnapshot> {
    const values = [
      input.bodyFatPercent,
      input.basalMetabolicRateKcal,
      input.skeletalMuscleMassKg,
      input.leanMassKg,
      input.visceralFatRating,
      input.weightKg,
    ];
    if (!values.some((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('Enter at least one body-composition measurement.');
    }
    if (input.bodyFatPercent !== undefined && (input.bodyFatPercent <= 0 || input.bodyFatPercent >= 100)) {
      throw new Error('Body-fat percentage must be between 0 and 100.');
    }
    if (input.basalMetabolicRateKcal !== undefined && input.basalMetabolicRateKcal <= 0) {
      throw new Error('BMR must be greater than zero.');
    }
    const createdAt = new Date().toISOString();
    return this.repository.addManualBodyComposition({
      id: createId('body_composition'),
      recordedAt: new Date(input.recordedAt).toISOString(),
      bodyFatPercent: input.bodyFatPercent,
      basalMetabolicRateKcal: input.basalMetabolicRateKcal,
      skeletalMuscleMassKg: input.skeletalMuscleMassKg,
      leanMassKg: input.leanMassKg,
      visceralFatRating: input.visceralFatRating,
      weightKg: input.weightKg,
      source: input.source,
      sourceLabel: input.sourceLabel?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt,
      schemaVersion: 1,
    });
  }

  deleteManualBodyComposition(recordId: string): Promise<MaisHealthEvidenceSnapshot> {
    return this.repository.deleteManualBodyComposition(recordId);
  }
}
