import { describe, expect, it } from 'vitest';
import { createMaisAnalysisInput, SimulatedMaisAnalysisSandbox, type MaisAnalysisProgram } from '../src/mais/analysisSandbox';
import { MaisCapabilityBus, createMaisCapabilityState } from '../src/mais/capabilityProtocol';
import { compileMaisContext, InMemoryMaisEvidenceProvider, type MaisEvidenceItem } from '../src/mais/contextCompiler';
import { MaisCoordinator } from '../src/mais/coordinator';
import { createMaisState, ingestMaisEvent } from '../src/mais/heart';
import { MaisModelLeaseManager, SimulatedMaisModelRuntime } from '../src/mais/modelLeases';
import { MaisReinforcementLedger } from '../src/mais/reinforcementLedger';
import { InMemoryMaisRepository } from '../src/mais/repository';
import { MaisResearchBroker } from '../src/mais/researchBroker';
import { buildMaisReportCard, exportMaisReportCard } from '../src/mais/reportCard';
import { deriveMaisResourceMode } from '../src/mais/resourceGovernor';
import { createDeterministicMaisRoleRunner } from '../src/mais/simulatedRoleRunner';
import { createMaisSystemSnapshot, normaliseMaisSystemSnapshot } from '../src/mais/systemState';
import { MaisWidgetFoundry } from '../src/mais/widgetFoundry';

const now = '2026-07-21T00:00:00.000Z';

function fullResources(capturedAt = now) {
  return {
    appVisibility: 'foreground' as const,
    batterySaver: false,
    isCharging: false,
    activeWorkoutInteraction: false,
    availableMemoryMb: 7_000,
    capturedAt,
  };
}

describe('MAIS capability protocol', () => {
  it('requires exact approval and can roll a reversible transaction back', async () => {
    let order = ['row', 'pulldown'];
    const bus = new MaisCapabilityBus(createMaisCapabilityState());
    bus.register({
      id: 'routine.test_order',
      kind: 'action',
      description: 'Temporarily test exercise order.',
      authorityLevel: 3,
      reversible: true,
      inputSchema: 'RoutineOrderChangeV1',
      outputSchema: 'RoutineOrderResultV1',
    }, {
      validate(payload) {
        return Array.isArray(payload.order) ? [] : ['order is required'];
      },
      async execute(payload) {
        const previous = [...order];
        order = [...(payload.order as string[])];
        return { result: { order }, rollbackToken: { previous } };
      },
      async revert(token) {
        order = [...((token as { previous: string[] }).previous)];
        return { order };
      },
    });

    const proposal = bus.propose('routine.test_order', 'Test a suspected order effect.', { order: ['pulldown', 'row'] }, now);
    expect(proposal.status).toBe('awaiting_approval');
    expect(() => bus.approve(proposal.id, 'wrong')).toThrow(/exact proposed change set/i);
    bus.approve(proposal.id, proposal.payloadFingerprint, { now });
    const execution = await bus.execute(proposal.id, now);
    expect(order).toEqual(['pulldown', 'row']);
    expect(execution.status).toBe('executed');
    await bus.revert(execution.id, now);
    expect(order).toEqual(['row', 'pulldown']);
  });
});

describe('MAIS model leases', () => {
  it('routes deep coding work to Qwen3-8B and guarantees one active model', async () => {
    const runtime = new SimulatedMaisModelRuntime();
    const manager = new MaisModelLeaseManager(runtime);
    const lease = await manager.acquire({ taskId: 'task_1', role: 'coding_analyst', tier: 'deep', now });
    expect(lease.modelId).toBe('qwen.qwen3-8b');
    await expect(manager.acquire({ taskId: 'task_2', role: 'governor', tier: 'light', now })).rejects.toThrow(/one active/i);
    await manager.release(lease.id, now);
    expect(runtime.loadedModelId).toBeNull();
    expect(runtime.loadCount).toBe(1);
    expect(runtime.unloadCount).toBe(1);
  });

  it('unloads the model when bounded work fails', async () => {
    const runtime = new SimulatedMaisModelRuntime();
    const manager = new MaisModelLeaseManager(runtime);
    await expect(manager.withLease(
      { taskId: 'task_failure', role: 'analyst', tier: 'standard', now },
      async () => { throw new Error('analysis failed'); },
    )).rejects.toThrow('analysis failed');
    expect(runtime.loadedModelId).toBeNull();
  });
});

describe('MAIS Context Compiler', () => {
  it('prioritises direct evidence, preserves provenance and obeys the context budget', async () => {
    let heart = createMaisState(now);
    heart = ingestMaisEvent(heart, { type: 'session_completed', entityRefs: ['session_direct'] }, now);
    const task = heart.tasks[0]!;
    const step = task.steps[0]!;
    const evidence: MaisEvidenceItem[] = [
      {
        id: 'session_direct',
        kind: 'session',
        title: 'Direct completed session',
        summary: 'The exact session that triggered the task.',
        data: { sets: 3 },
        provenanceRefs: ['session_direct'],
        relevance: 0.9,
      },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `unrelated_${index}`,
        kind: 'analysis' as const,
        title: `Unrelated evidence ${index}`,
        summary: 'x'.repeat(250),
        data: { index },
        provenanceRefs: [`other_${index}`],
        relevance: 0.2,
      })),
    ];
    const compiled = await compileMaisContext({
      task,
      step,
      triggerEvents: heart.events,
      taskArtifacts: [],
      capabilities: [],
      resourceMode: 'full',
      maxTokens: 550,
      requiredOutputSchema: step.outputSchema,
      now,
    }, new InMemoryMaisEvidenceProvider(evidence));

    expect(compiled.manifest.includedEvidenceIds).toContain('session_direct');
    expect(compiled.manifest.excludedEvidenceIds.length).toBeGreaterThan(0);
    expect(compiled.manifest.estimatedTokens).toBeLessThanOrEqual(550);
    expect(compiled.packet.evidence[0]?.provenanceRefs).toContain('session_direct');
  });
});

describe('MAIS Widget Foundry', () => {
  it('installs only declarative widgets and supports safe mode and permanent blocking', () => {
    const foundry = new MaisWidgetFoundry();
    const draft = foundry.createDraft({
      name: 'Order effect',
      purpose: 'Compare performance by routine position.',
      surface: 'progress.extended',
      createdByTaskId: 'task_widget',
      sourceArtifactIds: ['analysis_1'],
      permissionCapabilityIds: ['lab.open_analysis'],
      root: {
        id: 'root',
        type: 'stack',
        children: [
          { id: 'metric', type: 'metric', binding: 'analysis.effect' },
          { id: 'open', type: 'action', text: 'Open in Lab', actionCapabilityId: 'lab.open_analysis' },
        ],
      },
    }, now);
    foundry.install(draft.id, now);
    expect(foundry.visible('progress.extended')).toHaveLength(1);
    foundry.setSafeMode(true);
    expect(foundry.visible('progress.extended')).toHaveLength(0);
    foundry.setSafeMode(false);
    foundry.remove(draft.id, { blockRecreation: true, now });
    expect(() => foundry.createDraft({
      name: 'Order effect',
      purpose: 'Compare performance by routine position.',
      surface: 'progress.extended',
      createdByTaskId: 'task_widget_2',
      sourceArtifactIds: [],
      permissionCapabilityIds: [],
      root: { id: 'root2', type: 'text', text: 'Again' },
    }, now)).toThrow(/blocked/i);
  });
});

describe('MAIS analysis sandbox contract', () => {
  it('rejects programmes that request network or host access', async () => {
    const input = createMaisAnalysisInput('ExposureV1', [{ load: 80, reps: 6 }], ['session_1'], now);
    const programme: MaisAnalysisProgram = {
      id: 'programme_1',
      language: 'javascript_subset',
      source: 'const result = await fetch("https://example.com");',
      inputSnapshotId: input.id,
      outputSchema: 'AnalysisV1',
      permittedLibraries: [],
      createdByTaskId: 'task_1',
      createdAt: now,
    };
    const result = await new SimulatedMaisAnalysisSandbox().execute(programme, input);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics.join(' ')).toMatch(/network access/i);
  });
});

describe('MAIS Research Broker', () => {
  it('batches rare external research and refuses repeated active requests', () => {
    const broker = new MaisResearchBroker();
    const request = broker.request({
      topic: 'Rest duration in trained low-repetition resistance work',
      decisionBlocked: 'Whether to test 150 versus 210 seconds.',
      localContextSummary: 'Second-set output repeatedly falls.',
      questions: [{ question: 'What evidence compares these ranges?', whyItMatters: 'It changes the proposed experiment.' }],
      preferredEvidence: ['systematic reviews', 'controlled trials'],
      requiredOutputSchema: 'MaisResearchReportV1',
      freshness: 'current',
      expectedValue: 0.85,
      createdByTaskId: 'task_research',
    }, now);
    expect(request.status).toBe('awaiting_user_export');
    expect(() => broker.request({
      topic: 'Another topic',
      decisionBlocked: 'Another decision',
      localContextSummary: 'Context',
      questions: [{ question: 'Question?', whyItMatters: 'Reason' }],
      preferredEvidence: ['reviews'],
      requiredOutputSchema: 'MaisResearchReportV1',
      freshness: 'stable',
      expectedValue: 0.9,
      createdByTaskId: 'task_2',
    }, '2026-07-22T00:00:00.000Z')).toThrow(/already active/i);
  });
});

describe('MAIS reinforcement ledger', () => {
  it('keeps strategy credit domain-specific and preserves exploration', () => {
    const ledger = new MaisReinforcementLedger();
    ledger.record({
      taskId: 'task_rest',
      domain: 'principal_rest',
      strategy: 'extend_rest',
      outcome: {
        predictiveAccuracy: 0.8,
        calibration: 0.7,
        informationGain: 0.9,
        trainingOutcome: 0.6,
        userAcceptance: 0.8,
        novelty: 0.2,
        reversibility: 1,
        interruptionCost: 0.1,
        computeCost: 0.1,
        scientificSupport: 0.7,
      },
      now,
    });
    expect(ledger.rank('principal_rest')[0]?.score).toBeGreaterThan(0);
    expect(ledger.rank('exercise_order')).toHaveLength(0);
    expect(ledger.explorationCandidates('principal_rest')).toHaveLength(1);
  });
});

describe('MAIS persistence and report card', () => {
  it('resumes a checkpoint from the separate repository', async () => {
    const repository = new InMemoryMaisRepository();
    const first = new MaisCoordinator(repository, createDeterministicMaisRoleRunner());
    await first.initialise(now);
    await first.ingest({ type: 'session_completed', entityRefs: ['session_resume'] }, now);
    await first.pulse(fullResources());

    const restarted = new MaisCoordinator(repository, createDeterministicMaisRoleRunner());
    const restored = await restarted.initialise('2026-07-21T00:01:00.000Z');
    expect(restored.heart.tasks[0]?.status).toBe('checkpointed');
    const resumed = await restarted.pulse(fullResources('2026-07-21T00:02:00.000Z'));
    expect(resumed.lastPulseDecision?.action).toBe('resumed');
  });

  it('normalises partial framework state without touching training data', () => {
    const initial = createMaisSystemSnapshot(now);
    const restored = normaliseMaisSystemSnapshot({ systemVersion: 1, heart: initial.heart, createdAt: now, updatedAt: now }, now);
    expect(restored.capabilities.proposals).toEqual([]);
    expect(restored.widgets.safeMode).toBe(false);
  });

  it('exports operational artefacts while stripping hidden-reasoning fields', () => {
    const snapshot = createMaisSystemSnapshot(now);
    snapshot.diagnostics.push({
      id: 'diag_1',
      category: 'heart',
      severity: 'info',
      message: 'Operational plan stored.',
      refs: [],
      recordedAt: now,
      data: { plan: 'inspect evidence', chainOfThought: 'must not export' },
    });
    const card = buildMaisReportCard({
      heart: snapshot.heart,
      capabilities: snapshot.capabilities,
      models: snapshot.models,
      widgets: snapshot.widgets,
      research: snapshot.research,
      reinforcement: snapshot.reinforcement,
      contextManifests: snapshot.contextManifests,
      analysisRuns: snapshot.analysisRuns,
      diagnostics: snapshot.diagnostics,
      now,
    });
    const exported = exportMaisReportCard(card);
    expect(exported).toContain('inspect evidence');
    expect(exported.toLowerCase()).not.toContain('chainofthought');
    expect(exported).not.toContain('must not export');
  });
});

describe('MAIS resource policy without thermal polling', () => {
  it('uses visibility, Battery Saver, user pause and memory pressure only', () => {
    expect(deriveMaisResourceMode(fullResources())).toBe('full');
    expect(deriveMaisResourceMode({ ...fullResources(), batterySaver: true })).toBe('light');
    expect(deriveMaisResourceMode({ ...fullResources(), userPaused: true })).toBe('paused');
    expect(deriveMaisResourceMode({ ...fullResources(), thermalState: 'critical' })).toBe('full');
  });
});
