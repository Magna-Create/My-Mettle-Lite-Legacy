import { createId } from '../domain/ids';
import {
  createMaisAnalysisInput,
  DeterministicMaisAnalysisSandbox,
  type MaisAnalysisInputSnapshot,
  type MaisAnalysisProgram,
  type MaisAnalysisRun,
  type MaisAnalysisSandbox,
} from './analysisSandbox';
import type { MaisRoleRequest } from './contracts';
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

export function createCodingAnalystInput(
  request: MaisRoleRequest,
  evidence: MaisTrainingEvidencePacket | null,
  maximumRecords = 12,
  now = new Date().toISOString(),
): MaisAnalysisInputSnapshot {
  const records = evidence ? exposureRecords(evidence).slice(-Math.max(1, maximumRecords)) : [];
  const provenanceRefs = evidence
    ? [...new Set(records.flatMap((record) => {
      const exposureId = typeof record.exposureId === 'string' ? [record.exposureId] : [];
      const sessionId = typeof record.sessionId === 'string' ? [record.sessionId] : [];
      return [...exposureId, ...sessionId];
    }))]
    : request.triggerEvents.flatMap((event) => [event.id, ...event.entityRefs]);
  return createMaisAnalysisInput('MaisComparableExposureAnalysisInputV1', records, provenanceRefs, now);
}

export function codingAnalystInputPacket(input: MaisAnalysisInputSnapshot): Record<string, unknown> {
  return {
    id: input.id,
    schema: input.schema,
    immutableFingerprint: input.immutableFingerprint,
    provenanceRefs: input.provenanceRefs,
    records: input.records,
    allowedRecipeSchema: 'MaisAnalysisRecipeV1',
    supportedOperations: [
      'count',
      'sum',
      'mean',
      'median',
      'min',
      'max',
      'standard_deviation',
      'pearson',
      'linear_regression',
      'group_mean',
      'trimmed_mean',
    ],
  };
}

export async function executeCodingAnalystContent(
  content: Record<string, unknown>,
  input: MaisAnalysisInputSnapshot,
  request: MaisRoleRequest,
  sandbox: MaisAnalysisSandbox = new DeterministicMaisAnalysisSandbox(),
  now = new Date().toISOString(),
): Promise<MaisNativeAnalysisExecution> {
  if (!isRecord(content.programme)) throw new Error('Coding Analyst content has no programme object.');
  const programme = content.programme;
  if (programme.inputSnapshotId !== input.id) throw new Error('Coding Analyst programme referenced a different immutable input snapshot.');
  if (programme.language !== 'javascript_subset') throw new Error('Coding Analyst programme must use the deterministic JavaScript subset.');
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
  if (run.status !== 'completed') {
    throw new Error(`Generated analysis was ${run.status}: ${run.diagnostics.join(' ')}`);
  }
  return { input, program, run };
}
