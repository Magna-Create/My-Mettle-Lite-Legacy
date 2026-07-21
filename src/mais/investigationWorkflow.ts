import { createId } from '../domain/ids';
import type { MaisArtifact, MaisEvent, MaisState, MaisTaskStep } from './contracts';

export type MaisGovernorRoute = 'continue' | 'deep_analysis' | 'wait' | 'stop';

function governorRoute(artifact: MaisArtifact): MaisGovernorRoute | null {
  if (artifact.kind !== 'plan' || artifact.createdBy !== 'governor') return null;
  const route = artifact.content.route;
  return route === 'continue' || route === 'deep_analysis' || route === 'wait' || route === 'stop' ? route : null;
}

function createStep(
  role: MaisTaskStep['role'],
  goal: string,
  requiredTier: MaisTaskStep['requiredTier'],
  outputSchema: string,
): MaisTaskStep {
  return {
    id: createId('mais_step'),
    role,
    goal,
    requiredTier,
    outputSchema,
    status: 'pending',
  };
}

function taskEvents(state: MaisState, taskId: string): MaisEvent[] {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return [];
  return state.events.filter((event) => task.triggerEventIds.includes(event.id));
}

function completeWithoutFurtherAnalysis(state: MaisState, taskId: string, now: string): void {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  for (const step of task.steps.slice(task.currentStepIndex)) {
    if (step.status === 'pending') {
      step.status = 'completed';
      step.completedAt = now;
    }
  }
  task.currentStepIndex = task.steps.length;
  task.status = 'completed';
  task.checkpointId = undefined;
  task.updatedAt = now;
  const episode = [...state.episodes].reverse().find((candidate) => candidate.taskId === taskId && candidate.status === 'running');
  if (episode) {
    episode.status = 'completed';
    episode.endedAt = now;
    episode.terminationReason = 'task_complete';
  }
  for (const event of taskEvents(state, taskId)) {
    if (!event.processedByTaskIds.includes(taskId)) event.processedByTaskIds.push(taskId);
  }
}

export interface MaisGovernorRouteApplication {
  state: MaisState;
  route: MaisGovernorRoute | null;
  expanded: boolean;
  completedEarly: boolean;
  message: string | null;
}

export function applyMaisGovernorRoute(
  initial: MaisState,
  artifact: MaisArtifact,
  now = artifact.createdAt,
): MaisGovernorRouteApplication {
  const route = governorRoute(artifact);
  if (!route) return { state: initial, route: null, expanded: false, completedEarly: false, message: null };
  const state = structuredClone(initial);
  const task = state.tasks.find((candidate) => candidate.id === artifact.taskId);
  if (!task) return { state: initial, route, expanded: false, completedEarly: false, message: 'Governor route referenced an unknown task.' };

  if (route === 'stop' || route === 'wait') {
    completeWithoutFurtherAnalysis(state, task.id, now);
    return {
      state,
      route,
      expanded: false,
      completedEarly: true,
      message: route === 'stop'
        ? 'Governor ended the investigation because no useful further action was identified.'
        : 'Governor ended this episode until future evidence creates a new event.',
    };
  }

  const events = taskEvents(state, task.id);
  const supportsDeepExpansion = events.some((event) => event.type === 'session_completed' || event.type === 'session_amended');
  if (route !== 'deep_analysis' || !supportsDeepExpansion || task.steps.some((step) => step.role === 'coding_analyst')) {
    return { state, route, expanded: false, completedEarly: false, message: null };
  }

  const analystIndex = task.steps.findIndex((step) => step.role === 'analyst');
  const auditorIndex = task.steps.findIndex((step) => step.role === 'auditor');
  if (analystIndex < 0 || auditorIndex < 0) {
    return { state: initial, route, expanded: false, completedEarly: false, message: 'Deep route could not expand because the bounded analyst/auditor sequence was missing.' };
  }

  task.steps.splice(analystIndex + 1, 0, createStep(
    'coding_analyst',
    'Execute one reproducible analysis against an immutable host-created exposure snapshot.',
    'deep',
    'MaisInvestigationAnalysisV1',
  ));
  const shiftedAuditorIndex = task.steps.findIndex((step) => step.role === 'auditor');
  task.steps.splice(shiftedAuditorIndex + 1, 0, createStep(
    'coach',
    'Translate accepted evidence into one reversible training experiment proposal without applying it.',
    'standard',
    'MaisTrainingExperimentDraftV1',
  ));
  task.requiredTier = 'deep';
  task.updatedAt = now;
  return {
    state,
    route,
    expanded: true,
    completedEarly: false,
    message: 'Governor expanded this task into the bounded Qwen analysis and experiment-proposal path.',
  };
}
