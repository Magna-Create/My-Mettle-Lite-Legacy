import { createId } from '../domain/ids';
import { reduceMaisAnalysisArtifact } from './analysisArtifactReducer';
import { annotateMaisBeliefArtifact } from './beliefArtifactAnnotation';
import { reduceMaisBeliefArtifact } from './beliefArtifactReducer';
import { addMaisUnresolvedQuestion } from './beliefGraph';
import type { MaisArtifact, MaisEventInput, MaisResourceSnapshot, MaisRoleRunner } from './contracts';
import { ingestMaisEvent, pulseMais } from './heart';
import { applyMaisGovernorRoute } from './investigationWorkflow';
import {
  markMaisLabProposalMaterialised,
  markMaisLabProposalRejected,
  reduceMaisLabProposalArtifact,
} from './labProposalState';
import { reduceMaisMemoryArtifact } from './memoryLedger';
import { MaisModelLeaseManager, SimulatedMaisModelRuntime, type MaisModelRuntimeAdapter } from './modelLeases';
import { reduceMaisRejectionEvent } from './rejectionEventReducer';
import { reduceMaisResearchArtifact } from './researchArtifactReducer';
import { MaisResearchBroker, type MaisResearchReportEnvelope } from './researchBroker';
import type { MaisRepository } from './repository';
import {
  buildMaisReportCard,
  parseMaisParentReview,
  type MaisDiagnosticRecord,
  type MaisParentReview,
  type MaisReportCard,
} from './reportCard';
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
      const recordedAt = timestamp(now);
      current.heart = ingestMaisEvent(current.heart, input, recordedAt);
      const event = current.heart.events[current.heart.events.length - 1];
      if (event?.type === 'user_rejected_proposal') {
        const rejection = reduceMaisRejectionEvent(current.beliefs, event);
        current.beliefs = rejection.state;
        const proposalId = typeof event.payload.proposalId === 'string' ? event.payload.proposalId : null;
        if (proposalId && current.labProposals.proposals.some((proposal) => proposal.id === proposalId)) {
          current.labProposals = markMaisLabProposalRejected(current.labProposals, proposalId, recordedAt);
        }
        current.diagnostics.push({
          id: createId('mais_diagnostic'),
          category: 'belief',
          severity: rejection.applied ? 'info' : 'warning',
          message: rejection.applied
            ? 'The rejected proposal was added to durable rejection memory.'
            : (rejection.diagnostic ?? 'The rejected proposal could not be reduced into rejection memory.'),
          refs: [event.id, ...event.entityRefs],
          recordedAt,
          data: { proposalId, eventType: event.type },
        });
      }
      current.updatedAt = recordedAt;
      current.diagnostics = current.diagnostics.slice(-500);
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

      const newArtifactIds = current.heart.artifacts
        .filter((candidate) => !existingArtifactIds.has(candidate.id))
        .map((artifact) => artifact.id);

      for (const artifactId of newArtifactIds) {
        let artifact = current.heart.artifacts.find((candidate) => candidate.id === artifactId);
        if (!artifact) continue;

        const routeApplication = applyMaisGovernorRoute(current.heart, artifact, resources.capturedAt);
        current.heart = routeApplication.state;
        artifact = current.heart.artifacts.find((candidate) => candidate.id === artifactId) ?? artifact;
        if (routeApplication.message) {
          current.diagnostics.push({
            id: createId('mais_diagnostic'),
            category: 'heart',
            severity: routeApplication.completedEarly ? 'info' : routeApplication.expanded ? 'info' : 'warning',
            message: routeApplication.message,
            refs: [artifact.id, artifact.taskId],
            recordedAt: resources.capturedAt,
            data: {
              route: routeApplication.route,
              expanded: routeApplication.expanded,
              completedEarly: routeApplication.completedEarly,
            },
          });
        }

        this.reduceAnalysis(current, artifact, resources.capturedAt);
        this.reduceBelief(current, artifact, resources.capturedAt);
        this.reduceMemory(current, artifact, resources.capturedAt);
        this.reduceLabProposal(current, artifact, resources.capturedAt);
        this.reduceResearch(current, artifact, resources.capturedAt);
      }

      current.analysisInputs = current.analysisInputs.slice(-200);
      current.analysisPrograms = current.analysisPrograms.slice(-200);
      current.analysisRuns = current.analysisRuns.slice(-200);
      current.memories.records = current.memories.records.slice(-2_000);
      current.labProposals.proposals = current.labProposals.proposals.slice(-200);
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

  async markLabProposalsMaterialised(
    values: Array<{ proposalId: string; experimentId: string }>,
    now?: string,
  ): Promise<MaisSystemSnapshot> {
    if (values.length === 0) return this.snapshot();
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const recordedAt = timestamp(now);
      for (const value of values) {
        const proposal = current.labProposals.proposals.find((candidate) => candidate.id === value.proposalId);
        if (!proposal || proposal.status === 'materialised') continue;
        current.labProposals = markMaisLabProposalMaterialised(current.labProposals, value.proposalId, value.experimentId, recordedAt);
      }
      current.updatedAt = recordedAt;
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async rejectLabProposal(proposalId: string, now?: string): Promise<MaisSystemSnapshot> {
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const recordedAt = timestamp(now);
      current.labProposals = markMaisLabProposalRejected(current.labProposals, proposalId, recordedAt);
      current.updatedAt = recordedAt;
      await this.repository.save(current);
    });
    return this.snapshot();
  }

  async exportResearchRequest(requestId: string, now?: string): Promise<{ snapshot: MaisSystemSnapshot; document: string }> {
    let document = '';
    await this.enqueue(async () => {
      const current = this.requireSnapshot();
      const recordedAt = timestamp(now);
      const broker = new MaisResearchBroker(current.research);
      document = broker.export(requestId, recordedAt);
      current.research = broker.snapshot();
      current.updatedAt = recordedAt;
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
      const recordedAt = timestamp(now);
      const broker = new MaisResearchBroker(current.research);
      const request = broker.reject(requestId);
      current.research = broker.snapshot();
      current.updatedAt = recordedAt;
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'research',
        severity: 'info',
        message: 'The manual research request was rejected by the user.',
        refs: [request.id],
        recordedAt,
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
      memories: current.memories,
      labProposals: current.labProposals,
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

  private reduceAnalysis(current: MaisSystemSnapshot, artifact: MaisArtifact, recordedAt: string): void {
    const reduction = reduceMaisAnalysisArtifact(artifact);
    if (reduction.execution) {
      const { input, program, run } = reduction.execution;
      if (!current.analysisInputs.some((candidate) => candidate.id === input.id)) current.analysisInputs.push(input);
      if (!current.analysisPrograms.some((candidate) => candidate.id === program.id)) current.analysisPrograms.push(program);
      if (!current.analysisRuns.some((candidate) => candidate.id === run.id)) current.analysisRuns.push(run);
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'analysis',
        severity: run.status === 'completed' ? 'info' : 'warning',
        message: run.status === 'completed'
          ? 'A generated analysis executed against an immutable host snapshot.'
          : 'A generated analysis did not complete successfully.',
        refs: [artifact.id, input.id, program.id, run.id],
        recordedAt,
        data: { outputSchema: program.outputSchema, recordCount: input.records.length, executionMs: run.executionMs, status: run.status },
      });
    }
    for (const message of reduction.diagnostics) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'analysis',
        severity: 'warning',
        message,
        refs: [artifact.id, artifact.taskId],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
      });
    }
  }

  private reduceBelief(current: MaisSystemSnapshot, artifact: MaisArtifact, recordedAt: string): void {
    const before = current.beliefs;
    const reduction = reduceMaisBeliefArtifact(before, artifact);
    current.beliefs = reduction.state;
    const resolved = annotateMaisBeliefArtifact(artifact, before, current.beliefs);
    if (reduction.applied || resolved.length > 0) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'belief',
        severity: 'info',
        message: `${artifact.kind.replaceAll('_', ' ')} updated the persistent belief graph.`,
        refs: [artifact.id, artifact.taskId, ...resolved.map((belief) => belief.beliefId)],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy, resolvedBeliefCount: resolved.length },
      });
    }
    for (const message of reduction.diagnostics) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'belief',
        severity: 'warning',
        message,
        refs: [artifact.id, artifact.taskId],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
      });
    }
  }

  private reduceMemory(current: MaisSystemSnapshot, artifact: MaisArtifact, recordedAt: string): void {
    const reduction = reduceMaisMemoryArtifact(current.memories, artifact);
    current.memories = reduction.state;
    for (const question of reduction.unresolvedQuestions) {
      try {
        current.beliefs = addMaisUnresolvedQuestion(current.beliefs, {
          domain: question.domain,
          question: question.question,
          beliefIds: [],
          priority: question.priority,
          requiredEvidence: question.requiredEvidence,
          createdByTaskId: artifact.taskId,
        }, recordedAt);
      } catch (reason) {
        reduction.diagnostics.push(reason instanceof Error ? reason.message : String(reason));
      }
    }
    if (reduction.added.length > 0) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'context',
        severity: 'info',
        message: `${reduction.added.length} provenance-linked memory update${reduction.added.length === 1 ? '' : 's'} stored.`,
        refs: [artifact.id, ...reduction.added.map((memory) => memory.id)],
        recordedAt,
        data: { entityRefs: reduction.added.map((memory) => memory.entityRef) },
      });
    }
    for (const message of reduction.diagnostics) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'context',
        severity: 'warning',
        message,
        refs: [artifact.id, artifact.taskId],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
      });
    }
  }

  private reduceLabProposal(current: MaisSystemSnapshot, artifact: MaisArtifact, recordedAt: string): void {
    const reduction = reduceMaisLabProposalArtifact(current.labProposals, artifact);
    current.labProposals = reduction.state;
    if (reduction.proposal) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'capability',
        severity: 'info',
        message: 'A validated reversible experiment proposal is ready to enter Lab.',
        refs: [artifact.id, artifact.taskId, reduction.proposal.id],
        recordedAt,
        data: { exerciseId: reduction.proposal.exerciseId, proposedLoad: reduction.proposal.proposedLoad },
      });
    }
    for (const message of reduction.diagnostics) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'capability',
        severity: 'warning',
        message,
        refs: [artifact.id, artifact.taskId],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
      });
    }
  }

  private reduceResearch(current: MaisSystemSnapshot, artifact: MaisArtifact, recordedAt: string): void {
    const reduction = reduceMaisResearchArtifact(current.research, artifact);
    current.research = reduction.state;
    if (reduction.dossier) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'research',
        severity: 'info',
        message: 'A manual external-research dossier is ready for user review and export.',
        refs: [artifact.id, artifact.taskId, reduction.dossier.id],
        recordedAt,
        data: { topic: reduction.dossier.topic, expectedValue: reduction.dossier.expectedValue },
      });
    }
    for (const message of reduction.diagnostics) {
      current.diagnostics.push({
        id: createId('mais_diagnostic'),
        category: 'research',
        severity: 'warning',
        message,
        refs: [artifact.id, artifact.taskId],
        recordedAt,
        data: { artifactKind: artifact.kind, createdBy: artifact.createdBy },
      });
    }
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
