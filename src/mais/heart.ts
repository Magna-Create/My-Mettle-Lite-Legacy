import { createId } from '../domain/ids';
import type {
  MaisArtifact,
  MaisCheckpoint,
  MaisEpisode,
  MaisEvent,
  MaisEventInput,
  MaisModelTier,
  MaisPulseDecision,
  MaisPulseResult,
  MaisResourceSnapshot,
  MaisRole,
  MaisRoleResult,
  MaisRoleRunner,
  MaisState,
  MaisTask,
  MaisTaskStep,
} from './contracts';
import { MAIS_STATE_VERSION } from './contracts';
import { deriveMaisResourceMode, resourceModeAllowsTier } from './resourceGovernor';

interface StepDefinition {
  role: MaisRole;
  goal: string;
  requiredTier: MaisModelTier;
  outputSchema: string;
}

interface TaskDefinition {
  goal: string;
  priority: number;
  requiredTier: MaisModelTier;
  steps: StepDefinition[];
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function createSteps(definitions: StepDefinition[]): MaisTaskStep[] {
  return definitions.map((definition) => ({
    id: createId('mais_step'),
    ...definition,
    status: 'pending',
  }));
}

function taskDefinitionForEvent(event: MaisEvent): TaskDefinition | null {
  switch (event.type) {
    case 'session_completed':
    case 'session_amended':
      return {
        goal: `Integrate training evidence from ${event.type.replaceAll('_', ' ')}.`,
        priority: event.type === 'session_completed' ? 0.82 : 0.76,
        requiredTier: 'standard',
        steps: [
          { role: 'governor', goal: 'Identify affected evidence and decide the useful scope of analysis.', requiredTier: 'light', outputSchema: 'MaisInvestigationPlanV1' },
          { role: 'analyst', goal: 'Update relevant interpretations and unresolved questions.', requiredTier: 'standard', outputSchema: 'MaisEvidenceIntegrationV1' },
          { role: 'auditor', goal: 'Challenge comparability, confidence and alternative explanations.', requiredTier: 'standard', outputSchema: 'MaisAuditV1' },
        ],
      };
    case 'exercise_reflection_changed':
      return {
        goal: 'Integrate changed subjective exercise evidence without overwriting permanent exercise memory.',
        priority: 0.62,
        requiredTier: 'light',
        steps: [
          { role: 'memory_curator', goal: 'Link the reflection to its session exposure and affected themes.', requiredTier: 'light', outputSchema: 'MaisMemoryUpdateV1' },
          { role: 'governor', goal: 'Decide whether the reflection materially changes an active question.', requiredTier: 'light', outputSchema: 'MaisReflectionTriageV1' },
        ],
      };
    case 'routine_version_created':
      return {
        goal: 'Reconcile intelligence state with the new immutable routine version.',
        priority: 0.72,
        requiredTier: 'light',
        steps: [
          { role: 'memory_curator', goal: 'Record the routine change and identify beliefs tied to superseded slots.', requiredTier: 'light', outputSchema: 'MaisRoutineMemoryUpdateV1' },
          { role: 'governor', goal: 'Cancel, rebase or preserve affected tasks and experiments.', requiredTier: 'standard', outputSchema: 'MaisRoutineReconciliationV1' },
        ],
      };
    case 'experiment_threshold_reached':
      return {
        goal: 'Evaluate a matured training experiment and prepare an inspectable decision.',
        priority: 0.97,
        requiredTier: 'deep',
        steps: [
          { role: 'governor', goal: 'Compile experiment, baseline and outcome evidence.', requiredTier: 'light', outputSchema: 'MaisExperimentEvaluationPlanV1' },
          { role: 'coding_analyst', goal: 'Run the approved reproducible experiment analysis.', requiredTier: 'deep', outputSchema: 'MaisExperimentAnalysisV1' },
          { role: 'auditor', goal: 'Stress-test the result and identify ambiguity or collateral effects.', requiredTier: 'standard', outputSchema: 'MaisExperimentAuditV1' },
          { role: 'coach', goal: 'Prepare an adoption, extension, rejection or deferral proposal.', requiredTier: 'standard', outputSchema: 'MaisExperimentDecisionDraftV1' },
        ],
      };
    case 'health_data_imported':
      return {
        goal: 'Integrate imported health observations as provenance-preserving contextual evidence.',
        priority: 0.7,
        requiredTier: 'standard',
        steps: [
          { role: 'governor', goal: 'Identify affected sessions, readiness windows and duplicate candidates.', requiredTier: 'light', outputSchema: 'MaisHealthTriageV1' },
          { role: 'analyst', goal: 'Update contextual evidence without medical inference.', requiredTier: 'standard', outputSchema: 'MaisHealthEvidenceUpdateV1' },
        ],
      };
    case 'body_measurement_changed':
      return {
        goal: 'Update bodyweight-dependent historical and current evidence.',
        priority: 0.64,
        requiredTier: 'light',
        steps: [
          { role: 'memory_curator', goal: 'Link the measurement to affected effective-load calculations.', requiredTier: 'light', outputSchema: 'MaisMeasurementUpdateV1' },
        ],
      };
    case 'user_rejected_proposal':
      return {
        goal: 'Learn from a rejected proposal without suppressing unrelated exploration.',
        priority: 0.78,
        requiredTier: 'standard',
        steps: [
          { role: 'memory_curator', goal: 'Record exact rejection scope and required new evidence.', requiredTier: 'light', outputSchema: 'MaisRejectionMemoryV1' },
          { role: 'governor', goal: 'Adjust domain-specific strategy credit and cooldown.', requiredTier: 'standard', outputSchema: 'MaisPolicyCreditUpdateV1' },
        ],
      };
    case 'external_research_imported':
      return {
        goal: 'Validate and integrate an externally produced research dossier.',
        priority: 0.84,
        requiredTier: 'standard',
        steps: [
          { role: 'memory_curator', goal: 'Index claims, sources, scope and expiry.', requiredTier: 'light', outputSchema: 'MaisResearchMemoryV1' },
          { role: 'auditor', goal: 'Assess applicability, uncertainty and conflicts with local evidence.', requiredTier: 'standard', outputSchema: 'MaisResearchAuditV1' },
        ],
      };
    case 'maintenance_due':
      return {
        goal: 'Perform bounded intelligence maintenance and memory hygiene.',
        priority: 0.28,
        requiredTier: 'standard',
        steps: [
          { role: 'memory_curator', goal: 'Refresh stale summaries and unresolved-question indexes.', requiredTier: 'standard', outputSchema: 'MaisMaintenanceResultV1' },
          { role: 'auditor', goal: 'Identify unsupported or stale beliefs that need re-evaluation.', requiredTier: 'standard', outputSchema: 'MaisBeliefMaintenanceAuditV1' },
        ],
      };
    case 'app_foregrounded':
    case 'app_backgrounded':
      return null;
  }
}

export function createMaisState(now?: string): MaisState {
  const createdAt = timestamp(now);
  return {
    stateVersion: MAIS_STATE_VERSION,
    events: [],
    tasks: [],
    episodes: [],
    checkpoints: [],
    artifacts: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export function ingestMaisEvent(state: MaisState, input: MaisEventInput, recordedAt?: string): MaisState {
  const next = structuredClone(state);
  const now = timestamp(recordedAt);
  const event: MaisEvent = {
    id: createId('mais_event'),
    type: input.type,
    occurredAt: input.occurredAt ?? now,
    recordedAt: now,
    entityRefs: [...(input.entityRefs ?? [])],
    payload: structuredClone(input.payload ?? {}),
    processedByTaskIds: [],
    stateVersion: MAIS_STATE_VERSION,
  };
  next.events.push(event);

  const definition = taskDefinitionForEvent(event);
  if (definition) {
    const task: MaisTask = {
      id: createId('mais_task'),
      goal: definition.goal,
      triggerEventIds: [event.id],
      priority: definition.priority,
      requiredTier: definition.requiredTier,
      status: 'queued',
      steps: createSteps(definition.steps),
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };
    next.tasks.push(task);
  }

  next.updatedAt = now;
  return next;
}

function currentStep(task: MaisTask): MaisTaskStep | undefined {
  return task.steps[task.currentStepIndex];
}

function latestCheckpoint(state: MaisState, task: MaisTask): MaisCheckpoint | undefined {
  if (task.checkpointId) return state.checkpoints.find((checkpoint) => checkpoint.id === task.checkpointId);
  return [...state.checkpoints].reverse().find((checkpoint) => checkpoint.taskId === task.id);
}

function createCheckpoint(
  state: MaisState,
  task: MaisTask,
  episode: MaisEpisode,
  summary: string,
  now: string,
): MaisCheckpoint {
  const checkpoint: MaisCheckpoint = {
    id: createId('mais_checkpoint'),
    taskId: task.id,
    episodeId: episode.id,
    stepIndex: task.currentStepIndex,
    summary,
    nextRole: currentStep(task)?.role,
    createdAt: now,
  };
  state.checkpoints.push(checkpoint);
  task.checkpointId = checkpoint.id;
  task.status = 'checkpointed';
  task.updatedAt = now;
  return checkpoint;
}

function runningEpisode(state: MaisState, taskId: string): MaisEpisode | undefined {
  return [...state.episodes].reverse().find((episode) => episode.taskId === taskId && episode.status === 'running');
}

function openEpisode(state: MaisState, task: MaisTask, now: string): { episode: MaisEpisode; resumed: boolean } {
  const existing = runningEpisode(state, task.id);
  if (existing) return { episode: existing, resumed: false };
  const checkpoint = latestCheckpoint(state, task);
  const episode: MaisEpisode = {
    id: createId('mais_episode'),
    taskId: task.id,
    status: 'running',
    startedAt: now,
    resumedFromCheckpointId: checkpoint?.id,
    stepCount: 0,
  };
  state.episodes.push(episode);
  return { episode, resumed: Boolean(checkpoint) };
}

function closeEpisode(
  episode: MaisEpisode,
  status: MaisEpisode['status'],
  reason: NonNullable<MaisEpisode['terminationReason']>,
  now: string,
): void {
  episode.status = status;
  episode.terminationReason = reason;
  episode.endedAt = now;
}

function addArtifact(
  state: MaisState,
  task: MaisTask,
  episode: MaisEpisode,
  step: MaisTaskStep,
  result: MaisRoleResult,
  now: string,
): MaisArtifact | undefined {
  if (!result.artifact) return undefined;
  const artifact: MaisArtifact = {
    id: createId('mais_artifact'),
    taskId: task.id,
    episodeId: episode.id,
    kind: result.artifact.kind,
    createdBy: step.role,
    createdAt: now,
    content: structuredClone(result.artifact.content),
    provenanceRefs: [...(result.artifact.provenanceRefs ?? task.triggerEventIds)],
  };
  state.artifacts.push(artifact);
  return artifact;
}

function markTriggerEventsProcessed(state: MaisState, task: MaisTask): void {
  for (const event of state.events) {
    if (task.triggerEventIds.includes(event.id) && !event.processedByTaskIds.includes(task.id)) {
      event.processedByTaskIds.push(task.id);
    }
  }
}

function selectableTasks(state: MaisState): MaisTask[] {
  return state.tasks
    .filter((task) => ['queued', 'running', 'checkpointed'].includes(task.status))
    .sort((left, right) => right.priority - left.priority || left.createdAt.localeCompare(right.createdAt));
}

function pauseRunningWork(state: MaisState, now: string): MaisPulseDecision | null {
  const task = state.tasks.find((candidate) => candidate.status === 'running');
  if (!task) return null;
  const episode = runningEpisode(state, task.id);
  if (!episode) return null;
  const step = currentStep(task);
  if (step?.status === 'running') step.status = 'pending';
  createCheckpoint(state, task, episode, 'Resource Governor paused the episode before the next bounded role step.', now);
  closeEpisode(episode, 'paused', 'resource_pause', now);
  return {
    mode: 'paused',
    action: 'checkpointed',
    taskId: task.id,
    episodeId: episode.id,
    reason: 'Running work was checkpointed because MAIS is paused.',
  };
}

export async function pulseMais(
  state: MaisState,
  resources: MaisResourceSnapshot,
  runner: MaisRoleRunner,
): Promise<MaisPulseResult> {
  const next = structuredClone(state);
  const now = resources.capturedAt;
  const mode = deriveMaisResourceMode(resources);
  next.lastPulseAt = now;
  next.updatedAt = now;

  if (mode === 'paused') {
    const paused = pauseRunningWork(next, now);
    return {
      state: next,
      decision: paused ?? { mode, action: 'idle', reason: 'MAIS is paused and no role step was running.' },
    };
  }

  const task = selectableTasks(next)[0];
  if (!task) {
    return { state: next, decision: { mode, action: 'idle', reason: 'No queued or resumable MAIS work exists.' } };
  }

  const step = currentStep(task);
  if (!step) {
    task.status = 'completed';
    task.updatedAt = now;
    markTriggerEventsProcessed(next, task);
    return {
      state: next,
      decision: { mode, action: 'completed', taskId: task.id, reason: 'The task had no remaining role steps.' },
    };
  }

  if (!resourceModeAllowsTier(mode, step.requiredTier)) {
    return {
      state: next,
      decision: {
        mode,
        action: 'deferred',
        taskId: task.id,
        reason: `${step.requiredTier} work is not permitted in ${mode} mode.`,
      },
    };
  }

  const previousStatus = task.status;
  const { episode, resumed } = openEpisode(next, task, now);
  task.status = 'running';
  task.updatedAt = now;
  task.attempts += 1;
  step.status = 'running';
  step.startedAt ??= now;

  let result: MaisRoleResult;
  try {
    result = await runner.run({
      task: structuredClone(task),
      step: structuredClone(step),
      triggerEvents: next.events.filter((event) => task.triggerEventIds.includes(event.id)).map((event) => structuredClone(event)),
      taskArtifacts: next.artifacts.filter((artifact) => artifact.taskId === task.id).map((artifact) => structuredClone(artifact)),
      checkpoint: latestCheckpoint(next, task),
      resourceMode: mode,
    });
  } catch (reason) {
    result = {
      status: 'failed',
      summary: 'The role runner threw before producing a valid result.',
      error: reason instanceof Error ? reason.message : String(reason),
    };
  }

  addArtifact(next, task, episode, step, result, now);
  episode.stepCount += 1;

  if (result.status === 'completed') {
    step.status = 'completed';
    step.completedAt = now;
    task.currentStepIndex += 1;
    task.updatedAt = now;

    if (task.currentStepIndex >= task.steps.length) {
      task.status = 'completed';
      task.checkpointId = undefined;
      markTriggerEventsProcessed(next, task);
      closeEpisode(episode, 'completed', 'task_complete', now);
      return {
        state: next,
        decision: { mode, action: 'completed', taskId: task.id, episodeId: episode.id, reason: result.summary },
      };
    }

    createCheckpoint(next, task, episode, result.summary, now);
    closeEpisode(episode, 'completed', 'step_complete', now);
    return {
      state: next,
      decision: {
        mode,
        action: resumed || previousStatus === 'checkpointed' ? 'resumed' : 'advanced',
        taskId: task.id,
        episodeId: episode.id,
        reason: result.summary,
      },
    };
  }

  if (result.status === 'checkpoint') {
    step.status = 'pending';
    createCheckpoint(next, task, episode, result.summary, now);
    closeEpisode(episode, 'completed', 'runner_checkpoint', now);
    return {
      state: next,
      decision: { mode, action: 'checkpointed', taskId: task.id, episodeId: episode.id, reason: result.summary },
    };
  }

  if (result.status === 'waiting_for_tool' || result.status === 'waiting_for_approval') {
    step.status = 'pending';
    task.status = result.status;
    task.updatedAt = now;
    closeEpisode(
      episode,
      'completed',
      result.status === 'waiting_for_tool' ? 'waiting_for_tool' : 'waiting_for_approval',
      now,
    );
    return {
      state: next,
      decision: { mode, action: 'waiting', taskId: task.id, episodeId: episode.id, reason: result.summary },
    };
  }

  step.status = 'failed';
  step.error = result.error ?? result.summary;
  task.status = 'failed';
  task.lastError = step.error;
  task.updatedAt = now;
  closeEpisode(episode, 'failed', 'failure', now);
  return {
    state: next,
    decision: { mode, action: 'failed', taskId: task.id, episodeId: episode.id, reason: step.error },
  };
}

export function resumeMaisTask(state: MaisState, taskId: string, now?: string): MaisState {
  const next = structuredClone(state);
  const task = next.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error('MAIS task not found.');
  if (!['waiting_for_tool', 'waiting_for_approval', 'checkpointed'].includes(task.status)) {
    throw new Error(`MAIS task cannot resume from ${task.status}.`);
  }
  task.status = 'checkpointed';
  task.updatedAt = timestamp(now);
  next.updatedAt = task.updatedAt;
  return next;
}
