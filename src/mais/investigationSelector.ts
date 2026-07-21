import type { AppDatabase, Mode } from '../domain/model';
import { buildComparableExposureSeries, type MaisComparableExposure } from './comparableExposureEngine';

export type MaisInvestigationKind = 'plateau' | 'regression' | 'volatility' | 'mode_effect' | 'comfort_risk';

export interface MaisInvestigationCandidate {
  id: string;
  kind: MaisInvestigationKind;
  domain: string;
  exerciseId: string;
  exerciseName: string;
  question: string;
  priority: number;
  requiredTier: 'standard' | 'deep';
  reasonCodes: string[];
  evidenceRefs: string[];
  competingHypotheses: string[];
  confounds: string[];
  suggestedAnalysis: {
    inputSchema: 'MaisComparableExposureAnalysisInputV1';
    operations: Array<Record<string, unknown>>;
  };
}

export interface MaisInvestigationSelectionOptions {
  historyLimit?: number | undefined;
  maximumCandidates?: number | undefined;
  minimumExposures?: number | undefined;
}

interface MetricSeries {
  field: string;
  label: string;
  values: Array<{ exposure: MaisComparableExposure; value: number }>;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values: number[]): number | null {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function slope(values: number[]): number | null {
  if (values.length < 2) return null;
  const xMean = (values.length - 1) / 2;
  const yMean = mean(values)!;
  const denominator = values.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
  if (denominator === 0) return null;
  return values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0) / denominator;
}

function primaryMetric(exposures: MaisComparableExposure[]): MetricSeries | null {
  const fields: Array<[keyof MaisComparableExposure, string]> = [
    ['bestEstimatedOneRepMaxKg', 'estimated strength'],
    ['totalEffectiveVolumeKgReps', 'effective volume'],
    ['totalRepetitions', 'completed repetitions'],
    ['totalDurationSeconds', 'duration'],
    ['totalDistanceMetres', 'distance'],
  ];
  for (const [field, label] of fields) {
    const values = exposures.flatMap((exposure) => typeof exposure[field] === 'number'
      ? [{ exposure, value: exposure[field] as number }]
      : []);
    if (values.length >= Math.min(4, exposures.length)) return { field, label, values };
  }
  return null;
}

function evidenceRefs(exposures: MaisComparableExposure[]): string[] {
  return [...new Set(exposures.flatMap((exposure) => [exposure.id, exposure.sessionId, ...exposure.provenance.inputRefs]))];
}

function confoundsFor(exposures: MaisComparableExposure[]): string[] {
  const confounds: string[] = [];
  if (new Set(exposures.map((exposure) => exposure.mode)).size > 1) confounds.push('Training mode changed across the comparison window.');
  if (new Set(exposures.map((exposure) => exposure.routineVersionId)).size > 1) confounds.push('Routine version changed across the comparison window.');
  if (new Set(exposures.map((exposure) => exposure.trackingSignature)).size > 1) confounds.push('Tracking definition changed, so raw metrics may not be directly comparable.');
  const reflected = exposures.filter((exposure) => exposure.reflection).length;
  if (reflected < exposures.length / 2) confounds.push('Subjective execution and comfort evidence is sparse.');
  if (exposures.some((exposure) => exposure.completionRatio !== null && exposure.completionRatio < 1)) confounds.push('At least one exposure did not complete the prescribed set target.');
  return confounds;
}

function candidateId(kind: MaisInvestigationKind, exerciseId: string, refs: string[]): string {
  let hash = 0x811c9dc5;
  const input = `${kind}|${exerciseId}|${refs.join('|')}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `investigation-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function baseCandidate(
  kind: MaisInvestigationKind,
  exerciseId: string,
  exerciseName: string,
  exposures: MaisComparableExposure[],
): Omit<MaisInvestigationCandidate, 'question' | 'priority' | 'requiredTier' | 'reasonCodes' | 'competingHypotheses' | 'suggestedAnalysis'> {
  const refs = evidenceRefs(exposures);
  return {
    id: candidateId(kind, exerciseId, refs),
    kind,
    domain: `exercise:${exerciseId}`,
    exerciseId,
    exerciseName,
    evidenceRefs: refs,
    confounds: confoundsFor(exposures),
  };
}

function trendCandidates(exerciseId: string, exerciseName: string, exposures: MaisComparableExposure[]): MaisInvestigationCandidate[] {
  const metric = primaryMetric(exposures);
  if (!metric || metric.values.length < 6) return [];
  const window = metric.values.slice(-8);
  const values = window.map((item) => item.value);
  const average = mean(values);
  const trend = slope(values);
  if (average === null || trend === null || average === 0) return [];
  const relativeSlope = trend / Math.abs(average);
  const firstToLast = (values.at(-1)! - values[0]!) / Math.abs(average);
  const shared = baseCandidate(relativeSlope < -0.012 ? 'regression' : 'plateau', exerciseId, exerciseName, window.map((item) => item.exposure));

  if (relativeSlope < -0.012 && firstToLast < -0.06) {
    return [{
      ...shared,
      kind: 'regression',
      question: `Why is ${metric.label} declining for ${exerciseName}?`,
      priority: clamp01(0.72 + Math.min(0.2, Math.abs(relativeSlope) * 4)),
      requiredTier: 'deep',
      reasonCodes: ['negative_longitudinal_slope', 'meaningful_first_to_last_decline'],
      competingHypotheses: [
        'The exercise is accumulating more local or systemic fatigue.',
        'A routine-order or preceding-exercise change is suppressing output.',
        'Execution, setup or range of motion changed.',
        'The change is ordinary noise or reflects mixed modes rather than a real decline.',
      ],
      suggestedAnalysis: {
        inputSchema: 'MaisComparableExposureAnalysisInputV1',
        operations: [
          { op: 'linear_regression', x: 'exposureIndex', y: metric.field, as: 'trend' },
          { op: 'group_mean', groupBy: 'mode', field: metric.field, as: 'byMode' },
          { op: 'trimmed_mean', field: metric.field, trimFraction: 0.1, as: 'trimmedMean' },
        ],
      },
    }];
  }

  if (Math.abs(relativeSlope) <= 0.004 && Math.abs(firstToLast) <= 0.035) {
    return [{
      ...shared,
      kind: 'plateau',
      question: `Is ${exerciseName} genuinely plateaued, and which controllable variable should be tested?`,
      priority: clamp01(0.58 + Math.min(0.15, window.length * 0.015)),
      requiredTier: 'deep',
      reasonCodes: ['near_zero_longitudinal_slope', 'small_first_to_last_change'],
      competingHypotheses: [
        'The current loading and rep target has reached a stable ceiling.',
        'Progress is hidden by mode, order or bodyweight differences.',
        'Technique quality improved while the numeric metric stayed flat.',
        'The window is too short or noisy to call a plateau.',
      ],
      suggestedAnalysis: {
        inputSchema: 'MaisComparableExposureAnalysisInputV1',
        operations: [
          { op: 'linear_regression', x: 'exposureIndex', y: metric.field, as: 'trend' },
          { op: 'standard_deviation', field: metric.field, as: 'variability' },
          { op: 'group_mean', groupBy: 'mode', field: metric.field, as: 'byMode' },
        ],
      },
    }];
  }
  return [];
}

function volatilityCandidate(exerciseId: string, exerciseName: string, exposures: MaisComparableExposure[]): MaisInvestigationCandidate[] {
  const metric = primaryMetric(exposures);
  if (!metric || metric.values.length < 6) return [];
  const window = metric.values.slice(-10);
  const values = window.map((item) => item.value);
  const average = mean(values);
  const deviation = standardDeviation(values);
  if (average === null || deviation === null || average === 0 || deviation / Math.abs(average) < 0.14) return [];
  const shared = baseCandidate('volatility', exerciseId, exerciseName, window.map((item) => item.exposure));
  return [{
    ...shared,
    question: `What explains the unusually variable ${metric.label} for ${exerciseName}?`,
    priority: clamp01(0.55 + Math.min(0.25, deviation / Math.abs(average))),
    requiredTier: 'standard',
    reasonCodes: ['high_coefficient_of_variation'],
    competingHypotheses: [
      'Mode or routine position creates distinct performance conditions.',
      'Setup and execution consistency is poor.',
      'Recovery context varies materially between exposures.',
      'One or two outliers exaggerate otherwise stable performance.',
    ],
    suggestedAnalysis: {
      inputSchema: 'MaisComparableExposureAnalysisInputV1',
      operations: [
        { op: 'standard_deviation', field: metric.field, as: 'variability' },
        { op: 'group_mean', groupBy: 'mode', field: metric.field, as: 'byMode' },
        { op: 'trimmed_mean', field: metric.field, trimFraction: 0.1, as: 'trimmedMean' },
      ],
    },
  }];
}

function modeEffectCandidate(exerciseId: string, exerciseName: string, exposures: MaisComparableExposure[]): MaisInvestigationCandidate[] {
  const metric = primaryMetric(exposures);
  if (!metric || metric.values.length < 8) return [];
  const grouped = new Map<Mode, number[]>();
  for (const item of metric.values.slice(-18)) grouped.set(item.exposure.mode, [...(grouped.get(item.exposure.mode) ?? []), item.value]);
  const eligible = [...grouped.entries()].filter(([, values]) => values.length >= 3).map(([mode, values]) => ({ mode, mean: mean(values)! }));
  if (eligible.length < 2) return [];
  const overall = mean(eligible.map((item) => item.mean));
  const range = Math.max(...eligible.map((item) => item.mean)) - Math.min(...eligible.map((item) => item.mean));
  if (overall === null || overall === 0 || range / Math.abs(overall) < 0.1) return [];
  const window = metric.values.slice(-18).map((item) => item.exposure);
  const shared = baseCandidate('mode_effect', exerciseId, exerciseName, window);
  return [{
    ...shared,
    question: `Does training mode materially change ${exerciseName} performance?`,
    priority: clamp01(0.52 + Math.min(0.25, range / Math.abs(overall))),
    requiredTier: 'standard',
    reasonCodes: ['between_mode_mean_difference'],
    competingHypotheses: [
      'The mode prescription itself changes performance.',
      'Mode is standing in for exercise order, session duration or readiness.',
      'Different loading targets make the modes non-comparable.',
    ],
    suggestedAnalysis: {
      inputSchema: 'MaisComparableExposureAnalysisInputV1',
      operations: [
        { op: 'group_mean', groupBy: 'mode', field: metric.field, as: 'byMode' },
        { op: 'count', as: 'sampleSize' },
      ],
    },
  }];
}

function comfortCandidate(exerciseId: string, exerciseName: string, exposures: MaisComparableExposure[]): MaisInvestigationCandidate[] {
  const window = exposures.slice(-8);
  const concerning = window.filter((exposure) => ['uncomfortable', 'pain'].includes(String(exposure.reflection?.comfort)));
  if (concerning.length < 2) return [];
  const shared = baseCandidate('comfort_risk', exerciseId, exerciseName, window);
  return [{
    ...shared,
    question: `Why has ${exerciseName} repeatedly felt uncomfortable, and should setup or selection be tested?`,
    priority: clamp01(concerning.some((exposure) => exposure.reflection?.comfort === 'pain') ? 0.95 : 0.78),
    requiredTier: 'deep',
    reasonCodes: ['repeated_comfort_concern'],
    competingHypotheses: [
      'Machine or body setup is inconsistent.',
      'The selected load or range of motion exceeds the currently tolerable range.',
      'The exercise itself is a poor fit compared with a substitution.',
      'The reflection label lacks enough detail to identify the cause.',
    ],
    suggestedAnalysis: {
      inputSchema: 'MaisComparableExposureAnalysisInputV1',
      operations: [
        { op: 'group_mean', groupBy: 'comfort', field: 'bestEffectiveLoadKg', as: 'loadByComfort' },
        { op: 'count', as: 'exposureCount' },
      ],
    },
  }];
}

export function selectMaisInvestigationCandidates(
  database: AppDatabase,
  options: MaisInvestigationSelectionOptions = {},
): MaisInvestigationCandidate[] {
  const historyLimit = Math.max(6, options.historyLimit ?? 24);
  const minimumExposures = Math.max(3, options.minimumExposures ?? 6);
  const maximumCandidates = Math.max(1, options.maximumCandidates ?? 12);
  const exerciseIds = [...new Set(database.sessions
    .filter((session) => session.status === 'completed' && !session.discardedAt && !session.excludedFromInsights)
    .flatMap((session) => session.exercises.filter((exercise) => exercise.status === 'completed').map((exercise) => exercise.exerciseId)))];
  const candidates: MaisInvestigationCandidate[] = [];

  for (const exerciseId of exerciseIds) {
    const exposures = buildComparableExposureSeries(database, exerciseId, { limit: historyLimit });
    if (exposures.length < minimumExposures) continue;
    const exerciseName = database.exercises.find((exercise) => exercise.id === exerciseId)?.name
      ?? exposures.at(-1)?.exerciseId
      ?? exerciseId;
    candidates.push(
      ...comfortCandidate(exerciseId, exerciseName, exposures),
      ...trendCandidates(exerciseId, exerciseName, exposures),
      ...volatilityCandidate(exerciseId, exerciseName, exposures),
      ...modeEffectCandidate(exerciseId, exerciseName, exposures),
    );
  }

  const deduplicated = new Map(candidates.map((candidate) => [`${candidate.kind}:${candidate.exerciseId}`, candidate]));
  return [...deduplicated.values()]
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
    .slice(0, maximumCandidates);
}
