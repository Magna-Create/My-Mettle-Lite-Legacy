import type { MaisArtifactKind, MaisRole, MaisRoleRunner } from './contracts';

const artifactKindByRole: Record<MaisRole, MaisArtifactKind> = {
  governor: 'plan',
  analyst: 'belief_update',
  coding_analyst: 'analysis_result',
  auditor: 'audit',
  coach: 'lab_proposal_draft',
  memory_curator: 'memory_update',
  research_broker: 'research_request',
};

export function createDeterministicMaisRoleRunner(): MaisRoleRunner {
  return {
    async run(request) {
      return {
        status: 'completed',
        summary: `${request.step.role} completed ${request.step.outputSchema}.`,
        artifact: {
          kind: artifactKindByRole[request.step.role],
          content: {
            simulator: true,
            taskId: request.task.id,
            stepId: request.step.id,
            role: request.step.role,
            outputSchema: request.step.outputSchema,
            priorArtifactCount: request.taskArtifacts.length,
            resumedFromCheckpoint: Boolean(request.checkpoint),
          },
          provenanceRefs: request.triggerEvents.map((event) => event.id),
        },
      };
    },
  };
}
