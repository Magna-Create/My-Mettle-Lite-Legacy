import modelRegistryJson from '../../models/registry.json';
import { createId } from '../domain/ids';
import type { MaisModelTier, MaisRole } from './contracts';

export type MaisModelRole = MaisRole | 'retrieval' | 'multimodal';
export type MaisModelRuntimeName = 'litert' | 'litert-lm' | 'executorch' | 'geniex-qairt';
export type MaisModelCapability = 'retrieval' | 'everyday_language' | 'deep_reasoning' | 'multimodal';

export interface MaisRuntimeCandidate {
  runtime: MaisModelRuntimeName;
  format: string;
  backends: string[];
}

export interface MaisModelRegistryEntry {
  modelId: string;
  displayName: string;
  provider: string;
  source: string;
  revision: string;
  licence: string;
  roles: MaisModelRole[];
  runtimeCandidates: MaisRuntimeCandidate[];
  context: {
    nativeTokens?: number | undefined;
    extendedTokens?: number | undefined;
    maisDefaultTokens: number;
  };
  status: 'candidate' | 'approved' | 'disabled';
  notes: string;
}

export interface MaisModelLease {
  id: string;
  taskId: string;
  role: MaisModelRole;
  tier: MaisModelTier;
  modelId: string;
  runtime: MaisModelRuntimeName;
  backend: string;
  contextTokens: number;
  status: 'loading' | 'active' | 'released' | 'failed';
  acquiredAt: string;
  activatedAt?: string | undefined;
  releasedAt?: string | undefined;
  failureReason?: string | undefined;
}

export interface MaisModelLeaseState {
  leases: MaisModelLease[];
  activeLeaseId: string | null;
}

export interface MaisModelRuntimeAdapter {
  load(request: {
    model: MaisModelRegistryEntry;
    runtime: MaisModelRuntimeName;
    backend: string;
    contextTokens: number;
  }): Promise<void>;
  unload(modelId: string): Promise<void>;
}

export interface MaisLeaseRequest {
  taskId: string;
  role: MaisModelRole;
  tier: MaisModelTier;
  preferredRuntime?: MaisModelRuntimeName | undefined;
  preferredBackend?: string | undefined;
  contextTokens?: number | undefined;
  now?: string | undefined;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

export function getMaisModelRegistry(): MaisModelRegistryEntry[] {
  return structuredClone(modelRegistryJson as MaisModelRegistryEntry[]);
}

export function createMaisModelLeaseState(): MaisModelLeaseState {
  return { leases: [], activeLeaseId: null };
}

export function capabilityForRole(role: MaisModelRole, tier: MaisModelTier): MaisModelCapability {
  if (role === 'retrieval') return 'retrieval';
  if (role === 'multimodal') return 'multimodal';
  if (tier === 'deep' || role === 'coding_analyst') return 'deep_reasoning';
  return 'everyday_language';
}

function preferredModelIds(role: MaisModelRole, tier: MaisModelTier): string[] {
  switch (capabilityForRole(role, tier)) {
    case 'retrieval':
      return ['google.embeddinggemma'];
    case 'deep_reasoning':
      // The capability now resolves to the published 12K Qwen3-4B GenieX QAIRT
      // bundle. The surrounding Heart requests a capability rather than a binary,
      // so an 8K fallback can be introduced later without changing task contracts.
      return ['qwen.qwen3-4b', 'google.gemma-4-e2b-it'];
    case 'multimodal':
      return ['google.gemma-4-e2b-it'];
    default:
      return ['google.gemma-4-e2b-it'];
  }
}

export function selectMaisModel(
  role: MaisModelRole,
  tier: MaisModelTier,
  registry: MaisModelRegistryEntry[] = getMaisModelRegistry(),
): MaisModelRegistryEntry {
  const available = registry.filter((model) => model.status !== 'disabled' && model.roles.includes(role));
  const preferred = preferredModelIds(role, tier);
  for (const modelId of preferred) {
    const match = available.find((model) => model.modelId === modelId);
    if (match) return structuredClone(match);
  }
  const fallback = available[0];
  if (!fallback) throw new Error(`No MAIS model candidate supports ${role}.`);
  return structuredClone(fallback);
}

export class MaisModelLeaseManager {
  private state: MaisModelLeaseState;

  constructor(
    private readonly runtimeAdapter: MaisModelRuntimeAdapter,
    initialState: MaisModelLeaseState = createMaisModelLeaseState(),
    private readonly registry: MaisModelRegistryEntry[] = getMaisModelRegistry(),
  ) {
    this.state = structuredClone(initialState);
    const abandoned = this.state.leases.find((lease) => lease.id === this.state.activeLeaseId && ['loading', 'active'].includes(lease.status));
    if (abandoned) {
      abandoned.status = 'failed';
      abandoned.failureReason = 'Application process ended before the model lease was released.';
    }
    this.state.activeLeaseId = null;
  }

  snapshot(): MaisModelLeaseState {
    return structuredClone(this.state);
  }

  async acquire(request: MaisLeaseRequest): Promise<MaisModelLease> {
    if (this.state.activeLeaseId) throw new Error('MAIS permits only one active generative model lease at a time.');
    const model = selectMaisModel(request.role, request.tier, this.registry);
    const runtimeCandidate = model.runtimeCandidates.find((candidate) => candidate.runtime === request.preferredRuntime)
      ?? model.runtimeCandidates[0];
    if (!runtimeCandidate) throw new Error(`${model.modelId} has no registered runtime candidate.`);
    const backend = request.preferredBackend && runtimeCandidate.backends.includes(request.preferredBackend)
      ? request.preferredBackend
      : runtimeCandidate.backends[0];
    if (!backend) throw new Error(`${model.modelId} has no registered backend.`);

    const lease: MaisModelLease = {
      id: createId('mais_model_lease'),
      taskId: request.taskId,
      role: request.role,
      tier: request.tier,
      modelId: model.modelId,
      runtime: runtimeCandidate.runtime,
      backend,
      contextTokens: Math.min(request.contextTokens ?? model.context.maisDefaultTokens, model.context.extendedTokens ?? model.context.nativeTokens ?? Number.MAX_SAFE_INTEGER),
      status: 'loading',
      acquiredAt: timestamp(request.now),
    };
    this.state.leases.push(lease);
    this.state.activeLeaseId = lease.id;

    try {
      await this.runtimeAdapter.load({
        model,
        runtime: lease.runtime,
        backend,
        contextTokens: lease.contextTokens,
      });
      lease.status = 'active';
      lease.activatedAt = timestamp(request.now);
      return structuredClone(lease);
    } catch (reason) {
      lease.status = 'failed';
      lease.failureReason = reason instanceof Error ? reason.message : String(reason);
      this.state.activeLeaseId = null;
      throw reason;
    }
  }

  async release(leaseId: string, now?: string): Promise<MaisModelLease> {
    const lease = this.state.leases.find((candidate) => candidate.id === leaseId);
    if (!lease) throw new Error('MAIS model lease not found.');
    if (lease.status !== 'active') throw new Error(`Model lease cannot release from ${lease.status}.`);
    try {
      await this.runtimeAdapter.unload(lease.modelId);
      lease.status = 'released';
      lease.releasedAt = timestamp(now);
      this.state.activeLeaseId = null;
      return structuredClone(lease);
    } catch (reason) {
      lease.status = 'failed';
      lease.failureReason = reason instanceof Error ? reason.message : String(reason);
      this.state.activeLeaseId = null;
      throw reason;
    }
  }

  async withLease<T>(request: MaisLeaseRequest, operation: (lease: MaisModelLease) => Promise<T>): Promise<T> {
    const lease = await this.acquire(request);
    try {
      return await operation(lease);
    } finally {
      if (this.state.activeLeaseId === lease.id) await this.release(lease.id);
    }
  }
}

export class SimulatedMaisModelRuntime implements MaisModelRuntimeAdapter {
  loadedModelId: string | null = null;
  loadCount = 0;
  unloadCount = 0;

  async load(request: { model: MaisModelRegistryEntry }): Promise<void> {
    if (this.loadedModelId) throw new Error('A simulated model is already loaded.');
    this.loadedModelId = request.model.modelId;
    this.loadCount += 1;
  }

  async unload(modelId: string): Promise<void> {
    if (this.loadedModelId !== modelId) throw new Error('Attempted to unload a model that is not active.');
    this.loadedModelId = null;
    this.unloadCount += 1;
  }
}
