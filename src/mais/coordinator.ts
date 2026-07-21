import { createId } from '../domain/ids';
import type { MaisEventInput, MaisResourceSnapshot, MaisRoleRunner } from './contracts';
import { ingestMaisEvent, pulseMais } from './heart';
import { MaisModelLeaseManager, SimulatedMaisModelRuntime, type MaisModelRuntimeAdapter } from './modelLeases';
import type { MaisRepository } from './repository';
import { buildMaisReportCard, parseMaisParentReview, type MaisDiagnosticRecord, type MaisParentReview, type MaisReportCard } from './reportCard';
import { createMaisSystemSnapshot, type MaisSystemSnapshot } from './systemState';

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

export class MaisCoordinator {
  private snapshotValue: MaisSystemSnapshot | null = null;
  private operation: Promise<void> = Promise.resolve();
  private leaseManager: MaisModelLeaseManager | null = null;

  constructor(
    private readonly repository: MaisRepository,
    private readonly roleRunner: MaisRoleRunner,
    private readonly modelRuntime: MaisModelRuntimeAdapter = new SimulatedMaisModelRuntime(),
  ) {}

  async initialise(now?: string): Promise<MaisSystemSnapshot> {
    const stored = await this.repository.load();
    this.snapshotValue = stored ?? createMaisSystemSnapshot(timestamp(now));
    this.leaseManager = new MaisModelLeaseManager(this.modelRuntime, this.snapshotValue.models);
    this.snapshotValue.models = this.leaseManager.snapshot();
    await this.repository.save(this.snapshotValue);
    return this.snapshot();
  }

  snapshot(): MaisSystemSnapshot {
    if (!this.snapshotValue) throw new Error('MAIS coordinator has not been initialised.');
    return structuredClone(this.snapshotValue);
  }

  async ingest(input: MaisEventInput, now?: string): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      current.heart = ingestMaisEvent(current.heart, input, timestamp(now));
      current.updatedAt = timestamp(now);
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async pulse(resources: MaisResourceSnapshot): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      let runner = this.roleRunner;
      if (this.leaseManager) {
        const manager = this.leaseManager;
        runner = {
          run: (request) => manager.withLease(
            { taskId: request.task.id, role: request.step.role, tier: request.step.requiredTier, now: resources.capturedAt },
            async () => this.roleRunner.run(request),
          ),
        };
      }
      const result = await pulseMais(current.heart, resources, runner);
      current.heart = result.state;
      current.lastPulseDecision = result.decision;
      if (this.leaseManager) current.models = this.leaseManager.snapshot();
      current.updatedAt = resources.capturedAt;
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'heart',
        severity: result.decision.action === 'failed' ? 'error' : result.decision.action === 'deferred' ? 'warning' : 'info',
        message: result.decision.reason,
        refs: [result.decision.taskId, result.decision.episodeId].filter((value): value is string => Boolean(value)),
        recordedAt: resources.capturedAt,
        data: { action: result.decision.action, mode: result.decision.mode },
      });
      current.diagnostics = current.diagnostics.slice(-500);
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async runUntilSettled(resources: MaisResourceSnapshot, maximumPulses = 12): Promise<MaisSystemSnapshot> {
    for (let index = 0; index < maximumPulses; index += 1) {
      const nextResources = { ...resources, capturedAt: new Date(new Date(resources.capturedAt).getTime() + index).toISOString() };
      await this.pulse(nextResources);
      const action = this.requireSnapshot().lastPulseDecision?.action;
      if (!action || ['idle', 'deferred', 'waiting', 'failed'].includes(action)) break;
    }
    return this.snapshot();
  }

  async addDiagnostic(input: Omit<MaisDiagnosticRecord, 'id'>): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      current.diagnostics.push({ ...structuredClone(input), id: createId('mais_diagnostic') });
      current.diagnostics = current.diagnostics.slice(-500);
      current.updatedAt = input.recordedAt;
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  buildReportCard(now?: string): MaisReportCard {
    const current = this.requireSnapshot();
    return buildMaisReportCard({
      heart: current.heart,
      capabilities: current.capabilities,
      models: current.models,
      widgets: current.widgets,
      research: current.research,
      reinforcement: current.reinforcement,
      contextManifests: current.contextManifests,
      analysisRuns: current.analysisRuns,
      diagnostics: current.diagnostics,
      now,
    });
  }

  async importParentReview(value: string | MaisParentReview): Promise<MaisSystemSnapshot> {
    const review = parseMaisParentReview(value);
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      if (current.parentReviews.some((candidate) => candidate.id === review.id)) return;
      current.parentReviews.push(review);
      current.updatedAt = review.reviewedAt;
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async clear(now?: string): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      await this.repository.clear();
      this.snapshotValue = createMaisSystemSnapshot(timestamp(now));
      this.leaseManager = new MaisModelLeaseManager(this.modelRuntime, this.snapshotValue.models);
      await this.repository.save(this.snapshotValue);
    });
    return this.snapshot();
  }

  private requireSnapshot(): MaisSystemSnapshot {
    if (!this.snapshotValue) throw new Error('MAIS coordinator has not been initialised.');
    return this.snapshotValue;
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    this.operation = this.operation.then(operation, operation);
    await this.operation;
  }
}
