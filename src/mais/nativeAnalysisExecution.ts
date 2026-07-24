import { IndexedDbToolRequestRepository } from '../adapters/storage/IndexedDbToolRequestRepository';
import { createId } from '../domain/ids';
import {
  createMaisAnalysisInput,
  type MaisAnalysisInputSnapshot,
  type MaisAnalysisProgram,
  type MaisAnalysisRun,
  type MaisAnalysisSandbox,
} from './analysisSandbox';
import { ExpandedMaisAnalysisSandbox, MAIS_ANALYSIS_RECIPE_V2, MAIS_ANALYSIS_V2_OPERATIONS } from './expandedAnalysisSandbox';
import type { MaisRoleRequest } from './contracts';
import { MaisToolRequestBroker, type MaisToolFallbackPreference } from './toolRequestBroker';
import type { MaisTrainingEvidencePacket } from './trainingEvidence';

export interface MaisNativeAnalysisExecution {
  input: MaisAnalysisInputSnapshot;
  program: MaisAnalysisProgram;
  run: MaisAnalysisRun;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function exposureRecords(evidence: MaisTrainingEvidencePacket): Record<string, unknown>[] {
  return Object.entries(evidence.comparableExposures).flatMap(([exerciseId, exposures]) => exposures.map((exposure, exposureIndex) => ({
    recordKind: 'comparable_exposure',
    exposureIndex,
    exposureId: exposure.derivedMetrics.id,
    sessionId: exposure.sessionId,
    exerciseId,
    day: exposure.day,
    mode: exposure.mode,
    occurredAt: exposure.derivedMetrics.occurredAt,
    routineVersionId: exposure.routineVersionId,
    trackingSignature: exposure.derivedMetrics.trackingSignature,
    metric: exposure.derivedMetrics.metric,
    completionRatio: exposure.derivedMetrics.completionRatio,
    completedWorkSets: exposure.derivedMetrics.completedWorkSets,
    totalRepetitions: exposure.derivedMetrics.totalRepetitions,
    bestSetRepetitions: exposure.derivedMetrics.bestSetRepetitions,
    meanEffectiveLoadKg: exposure.derivedMetrics.meanEffectiveLoadKg,
    bestEffectiveLoadKg: exposure.derivedMetrics.bestEffectiveLoadKg,
    totalEffectiveVolumeKgReps: exposure.derivedMetrics.totalEffectiveVolumeKgReps,
    bestEstimatedOneRepMaxKg: exposure.derivedMetrics.bestEstimatedOneRepMaxKg,
    totalDurationSeconds: exposure.derivedMetrics.totalDurationSeconds,
    bestDurationSeconds: exposure.derivedMetrics.bestDurationSeconds,
    totalDistanceMetres: exposure.derivedMetrics.totalDistanceMetres,
    bestDistanceMetres: exposure.derivedMetrics.bestDistanceMetres,
    targetMuscleEngagement: exposure.derivedMetrics.reflection?.targetMuscleEngagement ?? null,
    executionQuality: exposure.derivedMetrics.reflection?.execution ?? null,
    enjoyment: exposure.derivedMetrics.reflection?.enjoyment ?? null,
    comfort: exposure.derivedMetrics.reflection?.comfort ?? null,
  })));
}

function healthRecords(evidence: MaisTrainingEvidencePacket): Record<string, unknown>[] {
  const sessions = evidence.healthSessionEvidence.flatMap((session) => [{
    recordKind: 'health_session',
    healthEvidenceId: session.id,
    sessionId: session.sessionId,
    occurredAt: session.completedAt,
    heartRateSampleCount: session.heartRateSampleCount,
    heartRateCoverage: session.heartRateCoverage,
    averageHeartRate: session.averageHeartRate,
    medianHeartRate: session.medianHeartRate,
    peakHeartRate: session.peakHeartRate,
    stepsDuringWindow: session.stepsDuringWindow,
    distanceMetresDuringWindow: session.distanceMetresDuringWindow,
  }, ...session.setResponses.map((set) => ({
    recordKind: 'heart_rate_set_response',
    healthEvidenceId: set.id,
    sessionId: set.sessionId,
    sessionExerciseId: set.sessionExerciseId,
    exerciseId: set.exerciseId,
    setId: set.setId,
    setIndex: set.setIndex,
    occurredAt: set.loggedCompletionAt,
    estimatedStartAt: set.estimatedStartAt,
    estimatedEndAt: set.estimatedEndAt,
    estimatedDurationSeconds: set.estimatedDurationSeconds,
    baselineHeartRate: set.baselineHeartRate,
    peakHeartRate: set.peakHeartRate,
    riseBeatsPerMinute: set.riseBeatsPerMinute,
    riseTimeSeconds: set.riseTimeSeconds,
    timeToPeakSeconds: set.timeToPeakSeconds,
    recovery30Seconds: set.recovery30Seconds,
    recovery60Seconds: set.recovery60Seconds,
    recovery90Seconds: set.recovery90Seconds,
    areaAboveBaselineBpmSeconds: set.areaAboveBaselineBpmSeconds,
    sampleCount: set.sampleCount,
    sampleCoverage: set.sampleCoverage,
    inferenceConfidence: set.inferenceConfidence,
    algorithmId: set.algorithmId,
    algorithmVersion: set.algorithmVersion,
  }))]);
  const body = evidence.manualBodyComposition.map((record) => ({
    recordKind: 'manual_body_composition',
    bodyCompositionId: record.id,
    occurredAt: record.recordedAt,
    bodyFatPercent: record.bodyFatPercent ?? null,
    basalMetabolicRateKcal: record.basalMetabolicRateKcal ?? null,
    skeletalMuscleMassKg: record.skeletalMuscleMassKg ?? null,
    leanMassKg: record.leanMassKg ?? null,
    visceralFatRating: record.visceralFatRating ?? null,
    weightKg: record.weightKg ?? null,
    measurementSource: record.source,
    sourceLabel: record.sourceLabel ?? null,
  }));
  return [...sessions, ...body];
}

export function createCodingAnalystInput(
  request: MaisRoleRequest,
  evidence: MaisTrainingEvidencePacket | null,
  maximumRecords = 12,
  now = new Date().toISOString(),
): MaisAnalysisInputSnapshot {
  const capacity = Math.max(1, maximumRecords);
  const health = evidence ? healthRecords(evidence) : [];
  const exposures = evidence ? exposureRecords(evidence) : [];
  const healthAllocation = Math.min(health.length, Math.max(0, Math.floor(capacity * 0.55)));
  const exposureAllocation = Math.min(exposures.length, capacity - healthAllocation);
  const spare = capacity - healthAllocation - exposureAllocation;
  const records = [
    ...exposures.slice(-(exposureAllocation + Math.min(spare, Math.max(0, exposures.length - exposureAllocation)))),
    ...health.slice(-healthAllocation),
  ].slice(-capacity);
  const provenanceRefs = evidence
    ? [...new Set(records.flatMap((record) => [
      typeof record.exposureId === 'string' ? record.exposureId : '',
      typeof record.healthEvidenceId === 'string' ? record.healthEvidenceId : '',
      typeof record.bodyCompositionId === 'string' ? record.bodyCompositionId : '',
      typeof record.sessionId === 'string' ? record.sessionId : '',
      typeof record.setId === 'string' ? record.setId : '',
    ]).filter(Boolean))]
    : request.triggerEvents.flatMap((event) => [event.id, ...event.entityRefs]);
  return createMaisAnalysisInput('MaisMultisourceAnalysisInputV2', records, provenanceRefs, now);
}

export function codingAnalystInputPacket(input: MaisAnalysisInputSnapshot): Record<string, unknown> {
  const fields = [...new Set(input.records.flatMap((record) => Object.keys(record)))].sort();
  const kinds = [...new Set(input.records.map((record) => record.recordKind).filter((value): value is string => typeof value === 'string'))];
  return {
    id: input.id,
    schema: input.schema,
    immutableFingerprint: input.immutableFingerprint,
    provenanceRefs: input.provenanceRefs,
    recordCount: input.records.length,
    recordKinds: kinds,
    availableFields: fields,
    records: input.records,
    allowedRecipeSchemas: ['MaisAnalysisRecipeV1', MAIS_ANALYSIS_RECIPE_V2],
    preferredRecipeSchema: MAIS_ANALYSIS_RECIPE_V2,
    supportedOperations: MAIS_ANALYSIS_V2_OPERATIONS,
    executionLimits: { maximumRecords: 5_000, maximumSteps: 64, arbitraryCode: false, network: false, databaseWrites: false },
    toolSuggestionContract: {
      optional: true,
      fields: ['title', 'analyticalQuestion', 'missingCapability', 'reasonExistingToolsFail', 'inputFields', 'desiredOutputs', 'proposedMethod', 'assumptions', 'minimumEvidence', 'requiredTests', 'exampleUse', 'fallbackPreference'],
      note: 'Use only when the current operation catalogue cannot responsibly express the required method.',
    },
  };
}

async function persistToolSuggestion(
  value: unknown,
  input: MaisAnalysisInputSnapshot,
  request: MaisRoleRequest,
  now: string,
): Promise<void> {
  if (!isRecord(value)) return;
  const repository = new IndexedDbToolRequestRepository();
  const broker = new MaisToolRequestBroker(await repository.load(), now);
  const preference = value.fallbackPreference;
  broker.create({
    title: typeof value.title === 'string' ? value.title : 'Suggested analysis capability',
    analyticalQuestion: typeof value.analyticalQuestion === 'string' ? value.analyticalQuestion : request.step.goal,
    missingCapability: typeof value.missingCapability === 'string' ? value.missingCapability : 'Unspecified operation gap',
    reasonExistingToolsFail: typeof value.reasonExistingToolsFail === 'string' ? value.reasonExistingToolsFail : 'The Coding Analyst reported that the current deterministic catalogue could not express the required analysis.',
    inputFields: stringArray(value.inputFields),
    desiredOutputs: stringArray(value.desiredOutputs),
    proposedMethod: typeof value.proposedMethod === 'string' ? value.proposedMethod : undefined,
    assumptions: stringArray(value.assumptions),
    minimumEvidence: stringArray(value.minimumEvidence),
    requiredTests: stringArray(value.requiredTests),
    exampleUse: typeof value.exampleUse === 'string' ? value.exampleUse : request.task.goal,
    fallbackPreference: preference === 'new_builtin' || preference === 'restricted_python' || preference === 'either'
      ? preference as MaisToolFallbackPreference
      : 'either',
    createdBy: 'coding_analyst',
    provenanceRefs: [input.id, request.task.id, request.step.id, ...input.provenanceRefs],
  }, now);
  await repository.save(broker.snapshot());
}

export async function executeCodingAnalystContent(
  content: Record<string, unknown>,
  input: MaisAnalysisInputSnapshot,
  request: MaisRoleRequest,
  sandbox: MaisAnalysisSandbox = new ExpandedMaisAnalysisSandbox(),
  now = new Date().toISOString(),
): Promise<MaisNativeAnalysisExecution> {
  await persistToolSuggestion(content.toolSuggestion, input, request, now);
  if (!isRecord(content.programme)) throw new Error('Coding Analyst content has no programme object.');
  const programme = content.programme;
  if (programme.inputSnapshotId !== input.id) throw new Error('Coding Analyst programme referenced a different immutable input snapshot.');
  if (programme.language !== 'javascript_subset') throw new Error('Coding Analyst programme must use the deterministic recipe language.');
  if (typeof programme.source !== 'string') throw new Error('Coding Analyst programme source is missing.');
  if (typeof programme.outputSchema !== 'string') throw new Error('Coding Analyst programme output schema is missing.');

  const program: MaisAnalysisProgram = {
    id: createId('mais_analysis_program'),
    language: 'javascript_subset',
    source: programme.source,
    inputSnapshotId: input.id,
    outputSchema: programme.outputSchema,
    permittedLibraries: stringArray(programme.permittedLibraries),
    createdByTaskId: request.task.id,
    createdAt: now,
  };
  const run = await sandbox.execute(program, input);
  if (run.status !== 'completed') throw new Error(`Generated analysis was ${run.status}: ${run.diagnostics.join(' ')}`);
  return { input, program, run };
}
