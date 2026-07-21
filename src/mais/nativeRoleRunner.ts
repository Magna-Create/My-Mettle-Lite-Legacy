import { Capacitor } from '@capacitor/core';
import type { MaisArtifactDraft, MaisArtifactKind, MaisRole, MaisRoleRequest, MaisRoleResult, MaisRoleResultStatus, MaisRoleRunner } from './contracts';
import { runMaisLiteRtPrompt, type MaisLiteRtBackend, type MaisLiteRtRunResult } from './liteRtRuntime';
import { getMaisGenerativeArtifacts, readMaisModelArtifactStatus, type MaisModelArtifactDefinition, type MaisModelArtifactStatus } from './modelArtifacts';
import { selectMaisModel } from './modelLeases';

const artifactKindByRole: Record<MaisRole, MaisArtifactKind> = {
  governor: 'plan',
  analyst: 'belief_update',
  coding_analyst: 'analysis_result',
  auditor: 'audit',
  coach: 'lab_proposal_draft',
  memory_curator: 'memory_update',
  research_broker: 'research_request',
};

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

function knownProvenanceRefs(request: MaisRoleRequest): Set<string> {
  const refs = new Set<string>([request.task.id, request.step.id]);
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

export function parseMaisNativeRoleOutput(raw: string, request: MaisRoleRequest): ParsedRoleOutput {
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

  const expectedKind = artifactKindByRole[request.step.role];
  if (artifact.kind !== expectedKind) {
    throw new Error(`The local model returned ${String(artifact.kind)} instead of ${expectedKind}.`);
  }
  if (!isPlainRecord(artifact.content)) throw new Error('The local model artefact content is invalid.');

  const allowedRefs = knownProvenanceRefs(request);
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

function compactRolePacket(request: MaisRoleRequest, maximumCharacters: number): string {
  const base = {
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
    priorArtifacts: request.taskArtifacts.slice(-8).map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      createdBy: artifact.createdBy,
      content: artifact.content,
      provenanceRefs: artifact.provenanceRefs,
    })),
  };

  let packet = JSON.stringify(base);
  if (packet.length <= maximumCharacters) return packet;

  const reduced = {
    ...base,
    priorArtifacts: base.priorArtifacts.slice(-3).map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      createdBy: artifact.createdBy,
      provenanceRefs: artifact.provenanceRefs,
    })),
    triggerEvents: base.triggerEvents.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      entityRefs: event.entityRefs,
    })),
  };
  packet = JSON.stringify(reduced);
  return packet.length <= maximumCharacters ? packet : packet.slice(0, maximumCharacters);
}

function roleSystemInstruction(role: MaisRole, artifactKind: MaisArtifactKind): string {
  return [
    `You are the ${role} role inside MAIS, the local intelligence system for My Mettle.`,
    'Use only the supplied packet. Never invent training records, measurements, scientific claims or user approval.',
    'Do not execute changes. You may only create a typed Workbench artefact.',
    'Preserve uncertainty. A missing fact stays missing.',
    'Do not output hidden reasoning, chain-of-thought or a chat response.',
    `Return only one compact JSON object using this exact shape: {"status":"completed","summary":"...","artifact":{"kind":"${artifactKind}","content":{},"provenanceRefs":[]}}.`,
    'Provenance references must be copied exactly from IDs present in the packet.',
  ].join(' ');
}

function rolePrompt(request: MaisRoleRequest, artifact: MaisModelArtifactDefinition): { prompt: string; systemInstruction: string; maxNumTokens: number } {
  const artifactKind = artifactKindByRole[request.step.role];
  const maximumCharacters = Math.max(1_200, Math.floor(artifact.contextTokens * 4 * 0.55));
  const packet = compactRolePacket(request, maximumCharacters);
  return {
    systemInstruction: roleSystemInstruction(request.step.role, artifactKind),
    prompt: `Complete the current bounded role step. Required output schema: ${request.step.outputSchema}. Packet:\n${packet}`,
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
        const backend = artifact.defaultBackend as MaisLiteRtBackend;
        const result = await runtime.run(artifact, backend, rolePrompt(request, artifact));
        if (!result.success) throw new Error(result.error ?? `${artifact.displayName} did not complete.`);
        return toRoleResult(parseMaisNativeRoleOutput(result.output, request), result);
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
