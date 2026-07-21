import { Capacitor } from '@capacitor/core';
import type { MaisArtifactDraft, MaisArtifactKind, MaisRole, MaisRoleRequest, MaisRoleResult, MaisRoleResultStatus, MaisRoleRunner } from './contracts';
import { runMaisLiteRtPrompt, type MaisLiteRtBackend, type MaisLiteRtRunResult } from './liteRtRuntime';
import { getMaisGenerativeArtifacts, readMaisModelArtifactStatus, type MaisModelArtifactDefinition, type MaisModelArtifactStatus } from './modelArtifacts';
import { selectMaisModel } from './modelLeases';
import { expectedArtifactKindForRole, formatMaisRoleContentContract, validateMaisRoleContent } from './roleOutputContracts';
import { IndexedDbMaisTrainingEvidenceProvider, type MaisTrainingEvidencePacket, type MaisTrainingEvidenceProvider } from './trainingEvidence';

const allowedStatuses = new Set<MaisRoleResultStatus>([
  'completed',
  'checkpoint',
  'waiting_for_tool',
  'waiting_for_approval',
  'failed',
]);

interface ParsedRoleOutput {
  status: MaisRoleResultStatus;
  summary: string;
  artifact: {
    kind: MaisArtifactKind;
    content: Record<string, unknown>;
    provenanceRefs: string[];
  };
}

export interface MaisNativeRoleRuntime {
  isAvailable(): boolean;
  readStatus(artifact: MaisModelArtifactDefinition): Promise<MaisModelArtifactStatus>;
  run(
    artifact: MaisModelArtifactDefinition,
    backend: MaisLiteRtBackend,
    prompt: { prompt: string; systemInstruction: string; maxNumTokens: number },
  ): Promise<MaisLiteRtRunResult>;
}

const defaultRuntime: MaisNativeRoleRuntime = {
  isAvailable: () => Capacitor.isNativePlatform(),
  readStatus: readMaisModelArtifactStatus,
  run: runMaisLiteRtPrompt,
};

const defaultEvidenceProvider = new IndexedDbMaisTrainingEvidenceProvider();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normaliseJsonText(value: string): string {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const first = withoutFence.indexOf('{');
  const last = withoutFence.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('The local model did not return a JSON object.');
  return withoutFence.slice(first, last + 1);
}

function knownProvenanceRefs(request: MaisRoleRequest, additionalRefs: string[] = []): Set<string> {
  const refs = new Set<string>([request.task.id, request.step.id, ...additionalRefs]);
  if (request.checkpoint) refs.add(request.checkpoint.id);
  for (const event of request.triggerEvents) {
    refs.add(event.id);
    event.entityRefs.forEach((ref) => refs.add(ref));
  }
  for (const artifact of request.taskArtifacts) {
    refs.add(artifact.id);
    artifact.provenanceRefs.forEach((ref) => refs.add(ref));
  }
  return refs;
}

function trainingEvidenceRefs(evidence: MaisTrainingEvidencePacket | null): string[] {
  if (!evidence) return [];
  return [...new Set([
    ...evidence.directRefs,
    ...evidence.sessions.flatMap((session) => [
      session.id,
      session.cycleId,
      session.routineVersionId,
      ...session.exercises.flatMap((exercise) => [exercise.sessionExerciseId, exercise.exerciseId, exercise.slotId, ...exercise.sets.map((set) => set.id)]),
    ]),
    ...evidence.exercises.map((exercise) => exercise.id),
    ...evidence.routines.flatMap((routine) => [routine.id, ...routine.days.flatMap((day) => day.slots.map((slot) => slot.id))]),
    ...evidence.experiments.map((experiment) => experiment.id),
    ...evidence.recentBodyMeasurements.map((measurement) => measurement.id),
  ])];
}

export function parseMaisNativeRoleOutput(
  raw: string,
  request: MaisRoleRequest,
  additionalProvenanceRefs: string[] = [],
): ParsedRoleOutput {
  const parsed = JSON.parse(normaliseJsonText(raw)) as unknown;
  if (!isPlainRecord(parsed)) throw new Error('The local model output is not an object.');

  const status = parsed.status;
  const summary = parsed.summary;
  const artifact = parsed.artifact;
  if (typeof status !== 'string' || !allowedStatuses.has(status as MaisRoleResultStatus)) {
    throw new Error('The local model returned an unsupported role status.');
  }
  if (typeof summary !== 'string' || summary.trim().length < 3 || summary.length > 1_200) {
    throw new Error('The local model returned an invalid role summary.');
  }
  if (!isPlainRecord(artifact)) throw new Error('The local model did not return an artefact.');

  const expectedKind = expectedArtifactKindForRole(request.step.role);
  if (artifact.kind !== expectedKind) {
    throw new Error(`The local model returned ${String(artifact.kind)} instead of ${expectedKind}.`);
  }
  if (!isPlainRecord(artifact.content)) throw new Error('The local model artefact content is invalid.');
  const contentValidation = validateMaisRoleContent(request.step.role, artifact.content);
  if (!contentValidation.valid) {
    throw new Error(`The local model returned an invalid ${request.step.role} content contract: ${contentValidation.errors.join(' ')}`);
  }

  const allowedRefs = knownProvenanceRefs(request, additionalProvenanceRefs);
  const requestedRefs = Array.isArray(artifact.provenanceRefs)
    ? artifact.provenanceRefs.filter((ref): ref is string => typeof ref === 'string')
    : [];
  const provenanceRefs = [...new Set(requestedRefs.filter((ref) => allowedRefs.has(ref)))];
  if (provenanceRefs.length === 0) provenanceRefs.push(...request.triggerEvents.map((event) => event.id));

  return {
    status: status as MaisRoleResultStatus,
    summary: summary.trim(),
    artifact: {
      kind: expectedKind,
      content: structuredClone(artifact.content),
      provenanceRefs,
    },
  };
}

function reducedTrainingEvidence(evidence: MaisTrainingEvidencePacket | null): unknown {
  if (!evidence) return null;
  return {
    generatedAt: evidence.generatedAt,
    sourceDatabaseUpdatedAt: evidence.sourceDatabaseUpdatedAt,
    directRefs: evidence.directRefs,
    sessions: evidence.sessions.map((session) => ({
      id: session.id,
      day: session.day,
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      excludedFromInsights: session.excludedFromInsights,
      bodyweightSnapshotKg: session.bodyweightSnapshotKg,
      exercises: session.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        importance: exercise.importance,
        tracking: exercise.tracking,
        plannedLoad: exercise.plannedLoad,
        status: exercise.status,
        sets: exercise.sets,
        reflection: exercise.reflection,
      })),
    })),
    comparableExposures: Object.fromEntries(Object.entries(evidence.comparableExposures)
      .map(([exerciseId, exposures]) => [exerciseId, exposures.slice(-3)])),
    exercises: evidence.exercises,
    experiments: evidence.experiments,
    warnings: evidence.warnings,
  };
}

function minimalTrainingEvidence(evidence: MaisTrainingEvidencePacket | null): unknown {
  if (!evidence) return null;
  return {
    sourceDatabaseUpdatedAt: evidence.sourceDatabaseUpdatedAt,
    directRefs: evidence.directRefs,
    sessions: evidence.sessions.map((session) => ({
      id: session.id,
      day: session.day,
      mode: session.mode,
      status: session.status,
      completedAt: session.completedAt,
      exercises: session.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        status: exercise.status,
        completedWorkSets: exercise.sets.filter((set) => !set.warmUp).map((set) => ({ load: set.load, reps: set.reps, durationSeconds: set.durationSeconds, distanceMetres: set.distanceMetres })),
        reflection: exercise.reflection,
      })),
    })),
    comparableExposures: Object.fromEntries(Object.entries(evidence.comparableExposures)
      .map(([exerciseId, exposures]) => [exerciseId, exposures.slice(-2).map((exposure) => ({
        sessionId: exposure.sessionId,
        mode: exposure.mode,
        derivedMetrics: exposure.derivedMetrics,
      }))])),
    warnings: evidence.warnings,
  };
}

function compactRolePacket(
  request: MaisRoleRequest,
  evidence: MaisTrainingEvidencePacket | null,
  maximumCharacters: number,
): string {
  const common = {
    task: {
      id: request.task.id,
      goal: request.task.goal,
      priority: request.task.priority,
      currentStepIndex: request.task.currentStepIndex,
    },
    step: {
      id: request.step.id,
      role: request.step.role,
      goal: request.step.goal,
      requiredTier: request.step.requiredTier,
      outputSchema: request.step.outputSchema,
    },
    checkpoint: request.checkpoint ? {
      id: request.checkpoint.id,
      summary: request.checkpoint.summary,
      stepIndex: request.checkpoint.stepIndex,
      nextRole: request.checkpoint.nextRole,
    } : null,
    resourceMode: request.resourceMode,
    triggerEvents: request.triggerEvents.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      entityRefs: event.entityRefs,
      payload: event.payload,
    })),
  };
  const priorArtifacts = request.taskArtifacts.slice(-8).map((artifact) => ({
    id: artifact.id,
    kind: artifact.kind,
    createdBy: artifact.createdBy,
    content: artifact.content,
    provenanceRefs: artifact.provenanceRefs,
  }));

  const candidates = [
    { ...common, priorArtifacts, trainingEvidence: evidence },
    { ...common, priorArtifacts: priorArtifacts.slice(-3), trainingEvidence: reducedTrainingEvidence(evidence) },
    {
      ...common,
      priorArtifacts: priorArtifacts.slice(-3).map((artifact) => ({ id: artifact.id, kind: artifact.kind, createdBy: artifact.createdBy, provenanceRefs: artifact.provenanceRefs })),
      trainingEvidence: minimalTrainingEvidence(evidence),
    },
    {
      ...common,
      triggerEvents: common.triggerEvents.map((event) => ({ id: event.id, type: event.type, occurredAt: event.occurredAt, entityRefs: event.entityRefs })),
      priorArtifacts: [],
      trainingEvidence: evidence ? { directRefs: evidence.directRefs, warnings: [...evidence.warnings, 'Training evidence exceeded this model context and was reduced to references.'] } : null,
    },
  ];

  for (const candidate of candidates) {
    const packet = JSON.stringify(candidate);
    if (packet.length <= maximumCharacters) return packet;
  }
  return JSON.stringify(candidates[candidates.length - 1]);
}

function roleSystemInstruction(role: MaisRole, artifactKind: MaisArtifactKind): string {
  return [
    `You are the ${role} role inside MAIS, the local intelligence system for My Mettle.`,
    'Use only the supplied packet. Never invent training records, measurements, scientific claims or user approval.',
    'Do not execute changes. You may only create a typed Workbench artefact.',
    'Preserve uncertainty. A missing fact stays missing.',
    'Separate observations from hypotheses and proposed next actions.',
    'Do not output hidden reasoning, chain-of-thought or a chat response.',
    formatMaisRoleContentContract(role),
    `Return only one compact JSON object using this exact outer shape: {"status":"completed","summary":"...","artifact":{"kind":"${artifactKind}","content":{},"provenanceRefs":[]}}.`,
    'Provenance references must be copied exactly from IDs present in the packet.',
  ].join(' ');
}

function rolePrompt(
  request: MaisRoleRequest,
  artifact: MaisModelArtifactDefinition,
  evidence: MaisTrainingEvidencePacket | null,
): { prompt: string; systemInstruction: string; maxNumTokens: number } {
  const artifactKind = expectedArtifactKindForRole(request.step.role);
  const maximumCharacters = Math.max(1_200, Math.floor(artifact.contextTokens * 4 * 0.55));
  const packet = compactRolePacket(request, evidence, maximumCharacters);
  return {
    systemInstruction: roleSystemInstruction(request.step.role, artifactKind),
    prompt: `Complete the current bounded role step. Required named schema: ${request.step.outputSchema}. The role-specific artifact.content contract is mandatory. Packet:\n${packet}`,
    maxNumTokens: artifact.contextTokens,
  };
}

function decorateFallback(
  result: MaisRoleResult,
  reason: string,
  modelId: string,
): MaisRoleResult {
  if (!result.artifact) return result;
  return {
    ...result,
    artifact: {
      ...result.artifact,
      content: {
        ...structuredClone(result.artifact.content),
        execution: {
          source: 'deterministic_fallback',
          intendedModelId: modelId,
          reason,
        },
      },
    },
  };
}

function toRoleResult(parsed: ParsedRoleOutput, runtime: MaisLiteRtRunResult): MaisRoleResult {
  const artifact: MaisArtifactDraft = {
    kind: parsed.artifact.kind,
    provenanceRefs: parsed.artifact.provenanceRefs,
    content: {
      ...parsed.artifact.content,
      execution: {
        source: 'local_model',
        modelId: runtime.modelId,
        runtime: runtime.runtime,
        runtimeVersion: runtime.runtimeVersion,
        backend: runtime.backend,
        loadMs: runtime.loadMs,
        firstChunkLatencyMs: runtime.firstChunkLatencyMs,
        generationMs: runtime.generationMs,
        unloadMs: runtime.unloadMs,
        totalMs: runtime.totalMs,
        peakPssBytes: runtime.peakPssBytes,
      },
    },
  };
  return {
    status: parsed.status,
    summary: parsed.summary,
    artifact,
    ...(parsed.status === 'failed' ? { error: parsed.summary } : {}),
  };
}

export function createNativeMaisRoleRunner(
  fallback: MaisRoleRunner,
  runtime: MaisNativeRoleRuntime = defaultRuntime,
  evidenceProvider: MaisTrainingEvidenceProvider = defaultEvidenceProvider,
): MaisRoleRunner {
  return {
    async run(request): Promise<MaisRoleResult> {
      const model = selectMaisModel(request.step.role, request.step.requiredTier);
      const artifact = getMaisGenerativeArtifacts().find((candidate) => candidate.modelId === model.modelId);
      if (!artifact) {
        return decorateFallback(await fallback.run(request), 'No generative artefact is registered for this role.', model.modelId);
      }
      if (!runtime.isAvailable()) {
        return decorateFallback(await fallback.run(request), 'Native inference is unavailable on this platform.', model.modelId);
      }

      try {
        const status = await runtime.readStatus(artifact);
        if (status.state !== 'ready') {
          return decorateFallback(await fallback.run(request), `${artifact.displayName} is not installed and verified.`, model.modelId);
        }
        const evidence = await evidenceProvider.read(request);
        const backend = artifact.defaultBackend as MaisLiteRtBackend;
        const result = await runtime.run(artifact, backend, rolePrompt(request, artifact, evidence));
        if (!result.success) throw new Error(result.error ?? `${artifact.displayName} did not complete.`);
        return toRoleResult(parseMaisNativeRoleOutput(result.output, request, trainingEvidenceRefs(evidence)), result);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        return decorateFallback(await fallback.run(request), message, model.modelId);
      }
    },
  };
}

export class EphemeralMaisModelRuntimeAdapter {
  private leasedModelId: string | null = null;

  async load(request: { model: { modelId: string } }): Promise<void> {
    if (this.leasedModelId) throw new Error('A MAIS model role already owns the runtime lease.');
    this.leasedModelId = request.model.modelId;
  }

  async unload(modelId: string): Promise<void> {
    if (this.leasedModelId !== modelId) throw new Error('The MAIS runtime lease does not match the active model.');
    this.leasedModelId = null;
  }
}
