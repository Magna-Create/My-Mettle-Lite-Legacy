import type { AppDatabase, Session, SessionExercise } from '../domain/model';
import type {
  NativeActivitySummary,
  NativeHealthInstantRecord,
  NativeHealthWindow,
  NativeHeartRateSample,
  NativeNutritionRecord,
} from './healthConnect';

export const HEALTH_EVIDENCE_SCHEMA_VERSION = 1;
export const HR_SET_RESPONSE_ALGORITHM_ID = 'mais.health.hr-set-response';
export const HR_SET_RESPONSE_ALGORITHM_VERSION = 1;

export type HealthEvidenceKind =
  | 'heart_rate_sample'
  | 'daily_activity'
  | 'exercise_session'
  | 'body_fat'
  | 'basal_metabolic_rate'
  | 'nutrition'
  | 'oxygen_saturation'
  | 'blood_glucose'
  | 'vo2_max'
  | 'manual_body_composition';

export interface MaisHealthEvidenceRecord {
  id: string;
  kind: HealthEvidenceKind;
  startTime: string;
  endTime?: string;
  value?: number;
  unit?: string;
  provider: 'health_connect' | 'manual';
  dataOrigin: string;
  sourceRecordId: string;
  sourceDevice?: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  importedAt: string;
  schemaVersion: number;
}

export interface MaisManualBodyCompositionRecord {
  id: string;
  recordedAt: string;
  bodyFatPercent?: number;
  basalMetabolicRateKcal?: number;
  skeletalMuscleMassKg?: number;
  leanMassKg?: number;
  visceralFatRating?: number;
  weightKg?: number;
  source: 'gym_bia' | 'home_scale' | 'samsung_device' | 'dexa' | 'manual_estimate' | 'other';
  sourceLabel?: string;
  note?: string;
  createdAt: string;
  schemaVersion: number;
}

export interface MaisSetHeartRateEvidence {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  setId: string;
  setIndex: number;
  loggedCompletionAt: string;
  estimatedStartAt: string | null;
  estimatedEndAt: string;
  estimatedDurationSeconds: number | null;
  baselineHeartRate: number | null;
  peakHeartRate: number | null;
  riseBeatsPerMinute: number | null;
  riseTimeSeconds: number | null;
  timeToPeakSeconds: number | null;
  recovery30Seconds: number | null;
  recovery60Seconds: number | null;
  recovery90Seconds: number | null;
  areaAboveBaselineBpmSeconds: number | null;
  sampleCount: number;
  sampleCoverage: number;
  inferenceConfidence: number;
  assumptions: string[];
  sourceRefs: string[];
  algorithmId: typeof HR_SET_RESPONSE_ALGORITHM_ID;
  algorithmVersion: typeof HR_SET_RESPONSE_ALGORITHM_VERSION;
  generatedAt: string;
}

export interface MaisSessionHealthEvidence {
  id: string;
  sessionId: string;
  startedAt: string;
  completedAt: string;
  heartRateSampleCount: number;
  heartRateCoverage: number;
  averageHeartRate: number | null;
  medianHeartRate: number | null;
  peakHeartRate: number | null;
  stepsDuringWindow: number | null;
  distanceMetresDuringWindow: number | null;
  setResponses: MaisSetHeartRateEvidence[];
  sourceRefs: string[];
  generatedAt: string;
  schemaVersion: number;
}

export interface MaisHealthEvidenceSnapshot {
  schemaVersion: number;
  observations: MaisHealthEvidenceRecord[];
  manualBodyComposition: MaisManualBodyCompositionRecord[];
  sessionEvidence: MaisSessionHealthEvidence[];
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function createHealthEvidenceSnapshot(now = new Date().toISOString()): MaisHealthEvidenceSnapshot {
  return {
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
    observations: [],
    manualBodyComposition: [],
    sessionEvidence: [],
    createdAt: now,
    updatedAt: now,
  };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function standardDeviation(values: number[]): number {
  const average = mean(values);
  if (average === null || values.length < 2) return 0;
  return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1));
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function secondsBetween(left: string | number, right: string | number): number {
  const leftMs = typeof left === 'number' ? left : Date.parse(left);
  const rightMs = typeof right === 'number' ? right : Date.parse(right);
  return (rightMs - leftMs) / 1_000;
}

function nearestValue(samples: NativeHeartRateSample[], targetMs: number, toleranceSeconds: number): number | null {
  let best: NativeHeartRateSample | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance = Math.abs(Date.parse(sample.time) - targetMs);
    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= toleranceSeconds * 1_000 ? best.beatsPerMinute : null;
}

function movingMedian(samples: NativeHeartRateSample[]): NativeHeartRateSample[] {
  return samples.map((sample, index) => {
    const window = samples.slice(Math.max(0, index - 1), Math.min(samples.length, index + 2));
    return { ...sample, beatsPerMinute: median(window.map((value) => value.beatsPerMinute)) ?? sample.beatsPerMinute };
  });
}

function expectedCoverage(samples: NativeHeartRateSample[], startMs: number, endMs: number): number {
  const durationSeconds = Math.max(1, (endMs - startMs) / 1_000);
  if (samples.length < 2) return 0;
  const gaps = samples.slice(1).map((sample, index) => secondsBetween(samples[index]!.time, sample.time)).filter((gap) => gap > 0);
  const typicalGap = median(gaps) ?? 10;
  const expectedSamples = Math.max(1, durationSeconds / Math.max(1, typicalGap));
  const largestGap = Math.max(0, ...gaps);
  const density = clamp(samples.length / expectedSamples);
  const continuityPenalty = clamp(1 - Math.max(0, largestGap - typicalGap * 2) / durationSeconds);
  return clamp(density * continuityPenalty);
}

function areaAboveBaseline(samples: NativeHeartRateSample[], baseline: number): number | null {
  if (samples.length < 2) return null;
  let area = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1]!;
    const after = samples[index]!;
    const elapsed = Math.max(0, secondsBetween(before.time, after.time));
    const beforeValue = Math.max(0, before.beatsPerMinute - baseline);
    const afterValue = Math.max(0, after.beatsPerMinute - baseline);
    area += ((beforeValue + afterValue) / 2) * elapsed;
  }
  return area;
}

function setHeartRateEvidence(
  session: Session,
  exercise: SessionExercise,
  set: SessionExercise['sets'][number],
  previousAnchor: string,
  allSamples: NativeHeartRateSample[],
  generatedAt: string,
): MaisSetHeartRateEvidence | null {
  if (!set.completedAt) return null;
  const completionMs = Date.parse(set.completedAt);
  const lowerAnchorMs = Math.max(Date.parse(previousAnchor), completionMs - 180_000);
  const analysisEndMs = completionMs + 90_000;
  const samples = movingMedian(allSamples
    .filter((sample) => {
      const time = Date.parse(sample.time);
      return time >= lowerAnchorMs && time <= analysisEndMs;
    })
    .sort((left, right) => left.time.localeCompare(right.time)));
  const preCompletion = samples.filter((sample) => Date.parse(sample.time) <= completionMs);
  if (preCompletion.length === 0) return null;

  const baselineWindow = preCompletion.filter((sample) => Date.parse(sample.time) <= Math.min(completionMs - 20_000, lowerAnchorMs + 60_000));
  const baselineValues = (baselineWindow.length ? baselineWindow : preCompletion.slice(0, Math.min(4, preCompletion.length)))
    .map((sample) => sample.beatsPerMinute);
  const baseline = median(baselineValues);
  const threshold = baseline === null ? null : baseline + Math.max(4, standardDeviation(baselineValues));

  let detectedRise: NativeHeartRateSample | null = null;
  if (threshold !== null) {
    for (let index = 0; index < preCompletion.length; index += 1) {
      const current = preCompletion[index]!;
      const next = preCompletion[index + 1];
      if (current.beatsPerMinute >= threshold && (!next || next.beatsPerMinute >= threshold - 1)) {
        detectedRise = current;
        break;
      }
    }
  }

  const inferredStartMs = detectedRise ? Math.max(lowerAnchorMs, Date.parse(detectedRise.time) - 8_000) : null;
  const peak = samples.reduce<NativeHeartRateSample | null>((best, sample) => !best || sample.beatsPerMinute > best.beatsPerMinute ? sample : best, null);
  const coverage = expectedCoverage(samples, lowerAnchorMs, analysisEndMs);
  const rise = baseline !== null && peak ? peak.beatsPerMinute - baseline : null;
  const signalStrength = rise === null ? 0 : clamp(rise / 20);
  const onsetStrength = inferredStartMs === null ? 0 : 1;
  const confidence = clamp(coverage * 0.55 + signalStrength * 0.25 + onsetStrength * 0.2);

  const recovery = (seconds: number): number | null => {
    if (!peak) return null;
    const value = nearestValue(samples, completionMs + seconds * 1_000, Math.max(12, seconds * 0.35));
    return value === null ? null : value - peak.beatsPerMinute;
  };

  const activeSamples = inferredStartMs === null
    ? []
    : samples.filter((sample) => Date.parse(sample.time) >= inferredStartMs && Date.parse(sample.time) <= analysisEndMs);

  return {
    id: `hr-set:${session.id}:${exercise.id}:${set.id}`,
    sessionId: session.id,
    sessionExerciseId: exercise.id,
    exerciseId: exercise.exerciseId,
    setId: set.id,
    setIndex: set.setIndex,
    loggedCompletionAt: set.completedAt,
    estimatedStartAt: inferredStartMs === null ? null : new Date(inferredStartMs).toISOString(),
    estimatedEndAt: set.completedAt,
    estimatedDurationSeconds: inferredStartMs === null ? null : Math.max(0, (completionMs - inferredStartMs) / 1_000),
    baselineHeartRate: baseline,
    peakHeartRate: peak?.beatsPerMinute ?? null,
    riseBeatsPerMinute: rise,
    riseTimeSeconds: inferredStartMs === null || !peak ? null : Math.max(0, (Date.parse(peak.time) - inferredStartMs) / 1_000),
    timeToPeakSeconds: inferredStartMs === null || !peak ? null : Math.max(0, (Date.parse(peak.time) - inferredStartMs) / 1_000),
    recovery30Seconds: recovery(30),
    recovery60Seconds: recovery(60),
    recovery90Seconds: recovery(90),
    areaAboveBaselineBpmSeconds: baseline === null ? null : areaAboveBaseline(activeSamples, baseline),
    sampleCount: samples.length,
    sampleCoverage: coverage,
    inferenceConfidence: confidence,
    assumptions: [
      'The app completion timestamp is an upper bound on physical set completion.',
      'A sustained heart-rate rise may refine set onset but never replaces the logged timeline.',
      'An eight-second personalised-lag placeholder is used until enough user-specific evidence exists.',
      'Wrist optical heart-rate data may contain motion artefacts and delayed peaks.',
    ],
    sourceRefs: [session.id, exercise.id, set.id, ...samples.map((sample) => sample.id)],
    algorithmId: HR_SET_RESPONSE_ALGORITHM_ID,
    algorithmVersion: HR_SET_RESPONSE_ALGORITHM_VERSION,
    generatedAt,
  };
}

export function deriveSessionHealthEvidence(
  session: Session,
  heartRate: NativeHeartRateSample[],
  activity: NativeActivitySummary,
  generatedAt = new Date().toISOString(),
): MaisSessionHealthEvidence | null {
  if (!session.completedAt) return null;
  const startMs = Date.parse(session.startedAt);
  const endMs = Date.parse(session.completedAt);
  const sessionSamples = heartRate
    .filter((sample) => Date.parse(sample.time) >= startMs && Date.parse(sample.time) <= endMs)
    .sort((left, right) => left.time.localeCompare(right.time));
  const setResponses: MaisSetHeartRateEvidence[] = [];

  for (const exercise of session.exercises) {
    let previousAnchor = exercise.startedAt ?? session.startedAt;
    for (const set of exercise.sets) {
      const evidence = setHeartRateEvidence(session, exercise, set, previousAnchor, heartRate, generatedAt);
      if (evidence) setResponses.push(evidence);
      if (set.completedAt) previousAnchor = set.completedAt;
    }
  }

  const values = sessionSamples.map((sample) => sample.beatsPerMinute).filter(finite);
  return {
    id: `health-session:${session.id}`,
    sessionId: session.id,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    heartRateSampleCount: sessionSamples.length,
    heartRateCoverage: expectedCoverage(sessionSamples, startMs, endMs),
    averageHeartRate: mean(values),
    medianHeartRate: median(values),
    peakHeartRate: values.length ? Math.max(...values) : null,
    stepsDuringWindow: finite(activity.steps) ? activity.steps : null,
    distanceMetresDuringWindow: finite(activity.distanceMetres) ? activity.distanceMetres : null,
    setResponses,
    sourceRefs: [session.id, ...sessionSamples.map((sample) => sample.id)],
    generatedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  };
}

function recordFromInstant(value: NativeHealthInstantRecord, importedAt: string): MaisHealthEvidenceRecord {
  return {
    id: `health:${value.type}:${value.id}`,
    kind: value.type,
    startTime: value.time,
    value: value.value,
    unit: value.unit,
    provider: 'health_connect',
    dataOrigin: value.dataOrigin,
    sourceRecordId: value.id,
    sourceDevice: value.device ?? null,
    payload: structuredClone(value as unknown as Record<string, unknown>),
    importedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  };
}

function recordFromNutrition(value: NativeNutritionRecord, importedAt: string): MaisHealthEvidenceRecord {
  return {
    id: `health:nutrition:${value.id}`,
    kind: 'nutrition',
    startTime: value.startTime,
    endTime: value.endTime,
    provider: 'health_connect',
    dataOrigin: value.dataOrigin,
    sourceRecordId: value.id,
    sourceDevice: value.device ?? null,
    payload: structuredClone(value as unknown as Record<string, unknown>),
    importedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  };
}

export function normaliseHealthWindow(window: NativeHealthWindow): MaisHealthEvidenceRecord[] {
  const importedAt = window.capturedAt;
  const heartRate = window.heartRate.map<MaisHealthEvidenceRecord>((sample) => ({
    id: `health:heart-rate:${sample.id}`,
    kind: 'heart_rate_sample',
    startTime: sample.time,
    value: sample.beatsPerMinute,
    unit: 'bpm',
    provider: 'health_connect',
    dataOrigin: sample.dataOrigin,
    sourceRecordId: sample.id,
    sourceDevice: sample.device ?? null,
    payload: structuredClone(sample as unknown as Record<string, unknown>),
    importedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  }));
  const exercise = window.exerciseSessions.map<MaisHealthEvidenceRecord>((record) => ({
    id: `health:exercise-session:${record.id}`,
    kind: 'exercise_session',
    startTime: record.startTime,
    endTime: record.endTime,
    provider: 'health_connect',
    dataOrigin: record.dataOrigin,
    sourceRecordId: record.id,
    sourceDevice: record.device ?? null,
    payload: structuredClone(record as unknown as Record<string, unknown>),
    importedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  }));
  const activity: MaisHealthEvidenceRecord[] = window.activity.available ? [{
    id: `health:activity:${window.startTime}:${window.endTime}`,
    kind: 'daily_activity',
    startTime: window.startTime,
    endTime: window.endTime,
    provider: 'health_connect',
    dataOrigin: window.activity.containsSamsungHealth ? 'com.sec.android.app.shealth' : 'health_connect.aggregate',
    sourceRecordId: `${window.startTime}:${window.endTime}`,
    payload: structuredClone(window.activity as unknown as Record<string, unknown>),
    importedAt,
    schemaVersion: HEALTH_EVIDENCE_SCHEMA_VERSION,
  }] : [];
  return [
    ...heartRate,
    ...activity,
    ...exercise,
    ...window.bodyComposition.map((value) => recordFromInstant(value, importedAt)),
    ...window.nutrition.map((value) => recordFromNutrition(value, importedAt)),
    ...window.supplementary.map((value) => recordFromInstant(value, importedAt)),
  ];
}

export function mergeHealthWindow(
  snapshot: MaisHealthEvidenceSnapshot,
  database: AppDatabase,
  window: NativeHealthWindow,
): MaisHealthEvidenceSnapshot {
  const records = new Map(snapshot.observations.map((record) => [record.id, record]));
  normaliseHealthWindow(window).forEach((record) => records.set(record.id, record));
  const sessions = new Map(snapshot.sessionEvidence.map((record) => [record.sessionId, record]));
  for (const session of database.sessions.filter((candidate) => candidate.status === 'completed' && candidate.completedAt)) {
    const overlaps = Date.parse(session.startedAt) <= Date.parse(window.endTime)
      && Date.parse(session.completedAt!) >= Date.parse(window.startTime);
    if (!overlaps) continue;
    const evidence = deriveSessionHealthEvidence(session, window.heartRate, window.activity, window.capturedAt);
    if (evidence) sessions.set(session.id, evidence);
  }
  return {
    ...snapshot,
    observations: [...records.values()].sort((left, right) => left.startTime.localeCompare(right.startTime)).slice(-100_000),
    sessionEvidence: [...sessions.values()].sort((left, right) => left.completedAt.localeCompare(right.completedAt)).slice(-2_000),
    lastSyncedAt: window.capturedAt,
    lastError: undefined,
    updatedAt: window.capturedAt,
  };
}
