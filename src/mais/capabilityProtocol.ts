import { createId } from '../domain/ids';

export type MaisAuthorityLevel = 0 | 1 | 2 | 3 | 4;
export type MaisCapabilityKind = 'resource' | 'action' | 'event' | 'ui';

export interface MaisCapabilityDescriptor {
  id: string;
  kind: MaisCapabilityKind;
  description: string;
  authorityLevel: MaisAuthorityLevel;
  reversible: boolean;
  inputSchema: string;
  outputSchema: string;
}

export type MaisProposalStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'reverted'
  | 'failed';

export interface MaisActionProposal {
  id: string;
  capabilityId: string;
  reason: string;
  payload: Record<string, unknown>;
  payloadFingerprint: string;
  authorityLevel: MaisAuthorityLevel;
  reversible: boolean;
  status: MaisProposalStatus;
  createdAt: string;
  updatedAt: string;
  approvalReceiptId?: string | undefined;
  executionId?: string | undefined;
  failureReason?: string | undefined;
}

export interface MaisApprovalReceipt {
  id: string;
  proposalId: string;
  capabilityId: string;
  payloadFingerprint: string;
  authorityLevel: MaisAuthorityLevel;
  approvedAt: string;
  approvedBy: 'user' | 'standing_policy';
  strongConfirmation: boolean;
}

export interface MaisExecutionRecord {
  id: string;
  proposalId: string;
  capabilityId: string;
  status: 'executed' | 'reverted' | 'failed';
  executedAt: string;
  revertedAt?: string | undefined;
  result: Record<string, unknown>;
  rollbackToken?: Record<string, unknown> | string | undefined;
  failureReason?: string | undefined;
}

export interface MaisCapabilityState {
  descriptors: MaisCapabilityDescriptor[];
  proposals: MaisActionProposal[];
  approvals: MaisApprovalReceipt[];
  executions: MaisExecutionRecord[];
}

export interface MaisCapabilityExecutionResult {
  result: Record<string, unknown>;
  rollbackToken?: Record<string, unknown> | string | undefined;
}

export interface MaisActionExecutor {
  validate(payload: Record<string, unknown>): string[];
  execute(payload: Record<string, unknown>): Promise<MaisCapabilityExecutionResult>;
  revert?(rollbackToken: Record<string, unknown> | string): Promise<Record<string, unknown>>;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`).join(',')}}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function fingerprintMaisAction(capabilityId: string, payload: Record<string, unknown>): string {
  return fnv1a(`${capabilityId}:${canonicalise(payload)}`);
}

export function createMaisCapabilityState(): MaisCapabilityState {
  return { descriptors: [], proposals: [], approvals: [], executions: [] };
}

export class MaisCapabilityBus {
  private state: MaisCapabilityState;
  private readonly executors = new Map<string, MaisActionExecutor>();

  constructor(initialState: MaisCapabilityState = createMaisCapabilityState()) {
    this.state = structuredClone(initialState);
  }

  snapshot(): MaisCapabilityState {
    return structuredClone(this.state);
  }

  register(descriptor: MaisCapabilityDescriptor, executor?: MaisActionExecutor): void {
    const existingIndex = this.state.descriptors.findIndex((candidate) => candidate.id === descriptor.id);
    if (existingIndex >= 0) this.state.descriptors[existingIndex] = structuredClone(descriptor);
    else this.state.descriptors.push(structuredClone(descriptor));
    if (executor) this.executors.set(descriptor.id, executor);
  }

  list(kind?: MaisCapabilityKind): MaisCapabilityDescriptor[] {
    return this.state.descriptors
      .filter((descriptor) => !kind || descriptor.kind === kind)
      .map((descriptor) => structuredClone(descriptor));
  }

  propose(capabilityId: string, reason: string, payload: Record<string, unknown>, now?: string): MaisActionProposal {
    const descriptor = this.state.descriptors.find((candidate) => candidate.id === capabilityId);
    if (!descriptor) throw new Error(`Unknown MAIS capability: ${capabilityId}`);
    if (descriptor.kind !== 'action' && descriptor.kind !== 'ui') {
      throw new Error(`${capabilityId} cannot create an action proposal.`);
    }

    const createdAt = timestamp(now);
    const proposal: MaisActionProposal = {
      id: createId('mais_proposal'),
      capabilityId,
      reason,
      payload: structuredClone(payload),
      payloadFingerprint: fingerprintMaisAction(capabilityId, payload),
      authorityLevel: descriptor.authorityLevel,
      reversible: descriptor.reversible,
      status: descriptor.authorityLevel >= 2 ? 'awaiting_approval' : 'approved',
      createdAt,
      updatedAt: createdAt,
    };
    this.state.proposals.push(proposal);
    return structuredClone(proposal);
  }

  approve(
    proposalId: string,
    payloadFingerprint: string,
    options: { approvedBy?: 'user' | 'standing_policy'; strongConfirmation?: boolean; now?: string } = {},
  ): MaisApprovalReceipt {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== 'awaiting_approval') throw new Error(`Proposal cannot be approved from ${proposal.status}.`);
    if (payloadFingerprint !== proposal.payloadFingerprint) throw new Error('Approval does not match the exact proposed change set.');
    if (proposal.authorityLevel === 4 && !options.strongConfirmation) {
      throw new Error('Level 4 capability requires strong confirmation.');
    }

    const receipt: MaisApprovalReceipt = {
      id: createId('mais_approval'),
      proposalId: proposal.id,
      capabilityId: proposal.capabilityId,
      payloadFingerprint: proposal.payloadFingerprint,
      authorityLevel: proposal.authorityLevel,
      approvedAt: timestamp(options.now),
      approvedBy: options.approvedBy ?? 'user',
      strongConfirmation: Boolean(options.strongConfirmation),
    };
    proposal.status = 'approved';
    proposal.approvalReceiptId = receipt.id;
    proposal.updatedAt = receipt.approvedAt;
    this.state.approvals.push(receipt);
    return structuredClone(receipt);
  }

  reject(proposalId: string, now?: string): MaisActionProposal {
    const proposal = this.requireProposal(proposalId);
    if (!['awaiting_approval', 'approved', 'draft'].includes(proposal.status)) {
      throw new Error(`Proposal cannot be rejected from ${proposal.status}.`);
    }
    proposal.status = 'rejected';
    proposal.updatedAt = timestamp(now);
    return structuredClone(proposal);
  }

  async execute(proposalId: string, now?: string): Promise<MaisExecutionRecord> {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== 'approved') throw new Error(`Proposal cannot execute from ${proposal.status}.`);
    if (fingerprintMaisAction(proposal.capabilityId, proposal.payload) !== proposal.payloadFingerprint) {
      throw new Error('Proposal payload changed after approval.');
    }
    if (proposal.authorityLevel >= 2) {
      const receipt = this.state.approvals.find((candidate) => candidate.id === proposal.approvalReceiptId);
      if (!receipt || receipt.payloadFingerprint !== proposal.payloadFingerprint) {
        throw new Error('No exact approval receipt exists for this proposal.');
      }
    }

    const executor = this.executors.get(proposal.capabilityId);
    if (!executor) throw new Error(`No executor registered for ${proposal.capabilityId}.`);
    const validationErrors = executor.validate(structuredClone(proposal.payload));
    if (validationErrors.length > 0) throw new Error(`Capability validation failed: ${validationErrors.join('; ')}`);

    const executedAt = timestamp(now);
    try {
      const outcome = await executor.execute(structuredClone(proposal.payload));
      if (proposal.reversible && !outcome.rollbackToken) {
        throw new Error('Reversible capability did not provide a rollback token.');
      }
      const execution: MaisExecutionRecord = {
        id: createId('mais_execution'),
        proposalId: proposal.id,
        capabilityId: proposal.capabilityId,
        status: 'executed',
        executedAt,
        result: structuredClone(outcome.result),
        rollbackToken: structuredClone(outcome.rollbackToken),
      };
      proposal.status = 'executed';
      proposal.executionId = execution.id;
      proposal.updatedAt = executedAt;
      this.state.executions.push(execution);
      return structuredClone(execution);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      const execution: MaisExecutionRecord = {
        id: createId('mais_execution'),
        proposalId: proposal.id,
        capabilityId: proposal.capabilityId,
        status: 'failed',
        executedAt,
        result: {},
        failureReason: message,
      };
      proposal.status = 'failed';
      proposal.failureReason = message;
      proposal.updatedAt = executedAt;
      this.state.executions.push(execution);
      throw reason;
    }
  }

  async revert(executionId: string, now?: string): Promise<MaisExecutionRecord> {
    const execution = this.state.executions.find((candidate) => candidate.id === executionId);
    if (!execution) throw new Error('MAIS execution not found.');
    if (execution.status !== 'executed') throw new Error(`Execution cannot be reverted from ${execution.status}.`);
    const proposal = this.requireProposal(execution.proposalId);
    if (!proposal.reversible || !execution.rollbackToken) throw new Error('Execution is not reversible.');
    const executor = this.executors.get(execution.capabilityId);
    if (!executor?.revert) throw new Error(`No rollback executor registered for ${execution.capabilityId}.`);

    const result = await executor.revert(structuredClone(execution.rollbackToken));
    execution.status = 'reverted';
    execution.revertedAt = timestamp(now);
    execution.result = { ...execution.result, revertResult: structuredClone(result) };
    proposal.status = 'reverted';
    proposal.updatedAt = execution.revertedAt;
    return structuredClone(execution);
  }

  private requireProposal(proposalId: string): MaisActionProposal {
    const proposal = this.state.proposals.find((candidate) => candidate.id === proposalId);
    if (!proposal) throw new Error('MAIS proposal not found.');
    return proposal;
  }
}
