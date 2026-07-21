import { createId } from '../domain/ids';
import { reduceMaisAnalysisArtifact } from './analysisArtifactReducer';
import { reduceMaisBeliefArtifact } from './beliefArtifactReducer';
import type { MaisEventInput, MaisResourceSnapshot, MaisRoleRunner } from './contracts';
import { ingestMaisEvent, pulseMais } from './heart';
import { MaisModelLeaseManager, SimulatedMaisModelRuntime, type MaisModelRuntimeAdapter } from './modelLeases';
import { reduceMaisResearchArtifact } from './researchArtifactReducer';
import {
  MaisResearchBroker,
  type MaisResearchReportEnvelope,
} from './researchBroker';
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
    const broker = new MaisResearchBroker(this.snapshotValue.research);
    this.snapshotValue.research = broker.expireDue(timestamp(now));
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
      const existingArtifactIds = new Set(current.heart.artifacts.map((artifact) => artifact.id));
      const expiryBroker = new MaisResearchBroker(current.research);
      current.research = expiryBroker.expireDue(resources.capturedAt);
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

      for (const artifact of current.heart.artifacts.filter((candidate) => !existingArtifactIds.has(candidate.id))) {
        const analysisReduction = reduceMaisAnalysisArtifact(artifact);
        if (analysisReduction.execution) {
          const { input, program, run } = analysisReduction.execution;
          if (!current.analysisInputs.some((candidate) => candidate.id === input.id)) current.analysisInputs.push(input);
          if (!current.analysisPrograms.some((candidate) => candidate.id === program.id)) current.analysisPrograms.push(program);
          if (!current.analysisRuns.some((candidate) => candidate.id === run.id)) current.analysisRuns.push(run);
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'analysis',
            severity: 'info',
            message: 'A generated analysis executed against an immutable host snapshot.',
            refs: [artifact.id, input.id, program.id, run.id],
            recordedAt: resources.capturedAt,
            data: { outputSchema: program.outputSchema, recordCount: input.records.length, executionMs: run.executionMs },
          });
        }
        for (const message of analysisReduction.diagnostics) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'analysis',
            severity: 'warning',
            message,
            refs: [artifact.id, artifact.taskId],
            recordedAt: resources.capturedAt,
            data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
          });
        }

        const beliefReduction = reduceMaisBeliefArtifact(current.beliefs, artifact);
        current.beliefs = beliefReduction.state;
        if (beliefReduction.applied) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'belief',
            severity: 'info',
            message: `${artifact.kind.replaceAll('_', ' ')} updated the persistent belief graph.`,
            refs: [artifact.id, artifact.taskId],
            recordedAt: resources.capturedAt,
            data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
          });
        }
        for (const message of beliefReduction.diagnostics) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'belief',
            severity: 'warning',
            message,
            refs: [artifact.id, artifact.taskId],
            recordedAt: resources.capturedAt,
            data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
          });
        }

        const researchReduction = reduceMaisResearchArtifact(current.research, artifact);
        current.research = researchReduction.state;
        if (researchReduction.dossier) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'research',
            severity: 'info',
            message: 'A manual external-research dossier is ready for user review and export.',
            refs: [artifact.id, artifact.taskId, researchReduction.dossier.id],
            recordedAt: resources.capturedAt,
            data: { topic: researchReduction.dossier.topic, expectedValue: researchReduction.dossier.expectedValue },
          });
        }
        for (const message of researchReduction.diagnostics) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'research',
            severity: 'warning',
            message,
            refs: [artifact.id, artifact.taskId],
            recordedAt: resources.capturedAt,
            data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
          });
        }
      }

      current.analysisInputs = current.analysisInputs.slice(-200);
      current.analysisPrograms = current.analysisPrograms.slice(-200);
      current.analysisRuns = current.analysisRuns.slice(-200);
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

  async exportResearchRequest(requestId: string, now?: string): Promise<{ snapshot: MaisSystemSnapshot; document: string }> {
    let document = '';
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const broker = new MaisResearchBroker(current.research);
      document = broker.export(requestId, timestamp(now));
      current.research = broker.snapshot();
      current.updatedAt = timestamp(now);
      await this.repository.save(current);
    });
    return { snapshot: this.snapshot(), document };
  }

  async importResearchReport(value: string | MaisResearchReportEnvelope, now?: string): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const importedAt = timestamp(now);
      const broker = new MaisResearchBroker(current.research);
      const report = broker.importEnvelope(value, importedAt);
      current.research = broker.snapshot();
      current.heart = ingestMaisEvent(current.heart, {
        type: 'external_research_imported',
        entityRefs: [report.id, report.requestId],
        payload: { reportId: report.id, requestId: report.requestId },
      }, importedAt);
      current.updatedAt = importedAt;
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'research',
        severity: 'info',
        message: 'A cited external research report was imported and queued for local integration.',
        refs: [report.id, report.requestId],
        recordedAt: importedAt,
        data: { sourceCount: report.sources.length, claimCount: report.claims.length },
      });
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async rejectResearchRequest(requestId: string, now?: string): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const broker = new MaisResearchBroker(current.research);
      const request = broker.reject(requestId);
      current.research = broker.snapshot();
      current.updatedAt = timestamp(now);
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'research',
        severity: 'info',
        message: 'The manual research request was rejected by the user.',
        refs: [request.id],
        recordedAt: current.updatedAt,
        data: { topic: request.topic },
      });
      await this.repository.save(current);
    });
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
      beliefs: current.beliefs,
      contextManifests: current.contextManifests,
      analysisInputs: current.analysisInputs,
      analysisPrograms: current.analysisPrograms,
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
