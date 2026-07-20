export const MAIS_STATE_VERSION = 1;

export type MaisEventType =
  | 'session_completed'
  | 'session_amended'
  | 'exercise_reflection_changed'
  | 'routine_version_created'
  | 'experiment_threshold_reached'
  | 'health_data_imported'
  | 'body_measurement_changed'
  | 'user_rejected_proposal'
  | 'external_research_imported'
  | 'app_foregrounded'
  | 'app_backgrounded'
  | 'maintenance_due';

export interface MaisEventInput {
  type: MaisEventType;
  occurredAt?: string;
  entityRefs?: string[];
  payload?: Record<string, unknown>;
}

export interface MaisEvent {
  id: string;
  type: MaisEventType;
  occurredAt: string;
  recordedAt: string;
  entityRefs: string[];
  payload: Record<string, unknown>;
  processedByTaskIds: string[];
  stateVersion: number;
}

export type MaisRole =
  | 'governor'
  | 'analyst'
  | 'coding_analyst'
  | 'auditor'
  | 'coach'
  | 'memory_curator'
  | 'research_broker';

export type MaisModelTier = 'light' | 'standard' | 'deep';

export type MaisTaskStatus =
  | 'queued'
  | 'running'
  | 'checkpointed'
  | 'waiting_for_tool'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MaisStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface MaisTaskStep {
  id: string;
  role: MaisRole;
  goal: string;
  requiredTier: MaisModelTier;
  outputSchema: string;
  status: MaisStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MaisTask {
  id: string;
  goal: string;
  triggerEventIds: string[];
  priority: number;
  requiredTier: MaisModelTier;
  status: MaisTaskStatus;
  steps: MaisTaskStep[];
  currentStepIndex: number;
  checkpointId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
}

export type MaisEpisodeStatus = 'running' | 'completed' | 'paused' | 'failed';

export interface MaisEpisode {
  id: string;
  taskId: string;
  status: MaisEpisodeStatus;
  startedAt: string;
  endedAt?: string;
  resumedFromCheckpointId?: string | undefined;
  stepCount: number;
  terminationReason?:
    | 'task_complete'
    | 'step_complete'
    | 'resource_pause'
    | 'waiting_for_tool'
    | 'waiting_for_approval'
    | 'runner_checkpoint'
    | 'failure';
}

export interface MaisCheckpoint {
  id: string;
  taskId: string;
  episodeId: string;
  stepIndex: number;
  summary: string;
  nextRole?: MaisRole | undefined;
  createdAt: string;
}

export type MaisArtifactKind =
  | 'plan'
  | 'analysis_request'
  | 'analysis_result'
  | 'audit'
  | 'belief_update'
  | 'lab_proposal_draft'
  | 'brief_context'
  | 'memory_update'
  | 'research_request'
  | 'widget_draft'
  | 'diagnostic';

export interface MaisArtifact {
  id: string;
  taskId: string;
  episodeId: string;
  kind: MaisArtifactKind;
  createdBy: MaisRole;
  createdAt: string;
  content: Record<string, unknown>;
  provenanceRefs: string[];
}

export interface MaisArtifactDraft {
  kind: MaisArtifactKind;
  content: Record<string, unknown>;
  provenanceRefs?: string[];
}

export interface MaisState {
  stateVersion: number;
  events: MaisEvent[];
  tasks: MaisTask[];
  episodes: MaisEpisode[];
  checkpoints: MaisCheckpoint[];
  artifacts: MaisArtifact[];
  createdAt: string;
  updatedAt: string;
  lastPulseAt?: string;
}

export type MaisAppVisibility = 'foreground' | 'background' | 'closed';
export type MaisThermalState = 'nominal' | 'fair' | 'serious' | 'critical';
export type MaisResourceMode = 'full' | 'standard' | 'light' | 'paused';

export interface MaisResourceSnapshot {
  appVisibility: MaisAppVisibility;
  batterySaver: boolean;
  thermalState: MaisThermalState;
  isCharging: boolean;
  activeWorkoutInteraction: boolean;
  availableMemoryMb?: number;
  capturedAt: string;
}

export interface MaisRoleRequest {
  task: MaisTask;
  step: MaisTaskStep;
  triggerEvents: MaisEvent[];
  taskArtifacts: MaisArtifact[];
  checkpoint?: MaisCheckpoint | undefined;
  resourceMode: MaisResourceMode;
}

export type MaisRoleResultStatus =
  | 'completed'
  | 'checkpoint'
  | 'waiting_for_tool'
  | 'waiting_for_approval'
  | 'failed';

export interface MaisRoleResult {
  status: MaisRoleResultStatus;
  summary: string;
  artifact?: MaisArtifactDraft;
  error?: string;
}

export interface MaisRoleRunner {
  run(request: MaisRoleRequest): Promise<MaisRoleResult>;
}

export interface MaisPulseDecision {
  mode: MaisResourceMode;
  action: 'idle' | 'deferred' | 'started' | 'resumed' | 'advanced' | 'checkpointed' | 'completed' | 'waiting' | 'failed';
  taskId?: string;
  episodeId?: string;
  reason: string;
}

export interface MaisPulseResult {
  state: MaisState;
  decision: MaisPulseDecision;
}
