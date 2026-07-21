import type { MaisArtifactKind, MaisRole, MaisRoleRunner } from './contracts';
import { createNativeMaisRoleRunner } from './nativeRoleRunner';

const artifactKindByRole: Record<MaisRole, MaisArtifactKind> = {
  governor: 'plan',
  analyst: 'belief_update',
  coding_analyst: 'analysis_result',
  auditor: 'audit',
  coach: 'lab_proposal_draft',
  memory_curator: 'memory_update',
  research_broker: 'research_request',
};

function createDeterministicFallbackRunner(): MaisRoleRunner {
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

/**
 * Historical name retained while Phase 3B transitions the Heart from simulation to installed local
 * models. Android uses a verified role model when available; tests, web and missing-model roles use
 * the deterministic fallback with the reason written into the resulting artefact.
 */
export function createDeterministicMaisRoleRunner(): MaisRoleRunner {
  return createNativeMaisRoleRunner(createDeterministicFallbackRunner());
}
