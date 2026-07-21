import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../src/data/seed';
import { createMaisBeliefGraphState } from '../src/mais/beliefGraph';
import type { MaisArtifact, MaisEvent } from '../src/mais/contracts';
import { materialiseMaisLabProposals } from '../src/mais/labProposalMaterialiser';
import { createMaisLabProposalState, reduceMaisLabProposalArtifact } from '../src/mais/labProposalState';
import { createMaisMemoryLedgerState, reduceMaisMemoryArtifact } from '../src/mais/memoryLedger';
import { reduceMaisRejectionEvent } from '../src/mais/rejectionEventReducer';

const now = '2026-07-21T17:30:00.000Z';

function artifact(kind: MaisArtifact['kind'], content: Record<string, unknown>, createdBy: MaisArtifact['createdBy']): MaisArtifact {
  return {
    id: `artifact_${kind}`,
    taskId: 'task_1',
    episodeId: 'episode_1',
    kind,
    createdBy,
    createdAt: now,
    content,
    provenanceRefs: ['session_1', 'exercise_evidence_1'],
  };
}

describe('functional MAIS reducers', () => {
  it('materialises a validated Coach draft as a proposed experiment without changing the routine', () => {
    const database = createSeedDatabase();
    const routineBefore = structuredClone(database.routineVersions);
    const exercise = database.exercises[0]!;
    const slot = database.routineVersions[0]!.days[0]!.slots[0]!;
    const reduction = reduceMaisLabProposalArtifact(createMaisLabProposalState(), artifact('lab_proposal_draft', {
      proposal: {
        type: 'training_experiment',
        rationale: 'Test whether a small load increase preserves the target repetitions.',
        exerciseId: exercise.id,
        routineSlotId: slot.id,
        baselineLoad: slot.plannedLoad,
        proposedLoad: slot.plannedLoad + exercise.progressionStep,
        targetRepMin: slot.prescriptions.A.repMin,
        reversible: true,
        successCriteria: ['Complete the target repetitions with clean execution.'],
        stopConditions: ['Stop if comfort is recorded as pain.'],
      },
      presentation: { title: 'Small load progression', summary: 'One temporary exposure at the next load step.' },
    }, 'coach'));
    expect(reduction.proposal?.status).toBe('ready');

    const materialised = materialiseMaisLabProposals(database, reduction.state);
    expect(materialised.materialised).toHaveLength(1);
    expect(materialised.database.experiments.at(-1)).toMatchObject({
      exerciseId: exercise.id,
      routineSlotId: slot.id,
      status: 'proposed',
      baselineLoad: slot.plannedLoad,
      proposedLoad: slot.plannedLoad + exercise.progressionStep,
    });
    expect(materialised.database.routineVersions).toEqual(routineBefore);
  });

  it('stores provenance-linked memory and refuses unsupported provenance', () => {
    const valid = reduceMaisMemoryArtifact(createMaisMemoryLedgerState(), artifact('memory_update', {
      memoryUpdates: [{
        entityRef: 'exercise_1',
        summary: 'The lower bench setting felt more stable.',
        tags: ['setup'],
        provenanceRefs: ['session_1'],
        confidence: 'subjective',
      }],
      unresolvedQuestions: [],
    }, 'memory_curator'));
    expect(valid.added).toHaveLength(1);
    expect(valid.added[0]!.provenanceRefs).toEqual(['session_1']);

    const invalidArtifact = artifact('memory_update', {
      memoryUpdates: [{ entityRef: 'exercise_2', summary: 'Unsupported memory.', provenanceRefs: ['invented'] }],
      unresolvedQuestions: [],
    }, 'memory_curator');
    invalidArtifact.provenanceRefs = [];
    const invalid = reduceMaisMemoryArtifact(valid.state, invalidArtifact);
    expect(invalid.added).toHaveLength(0);
    expect(invalid.diagnostics.join(' ')).toMatch(/no valid provenance/i);
  });

  it('turns a user rejection into durable proposal memory', () => {
    const event: MaisEvent = {
      id: 'event_rejection',
      type: 'user_rejected_proposal',
      occurredAt: now,
      recordedAt: now,
      entityRefs: ['experiment_1'],
      payload: {
        domain: 'training_experiment',
        scope: 'exercise_1',
        reason: 'The proposed load increase felt premature.',
        proposal: { exerciseId: 'exercise_1', proposedLoad: 42 },
        requiredNewEvidence: ['two stable exposures at the current load'],
      },
      processedByTaskIds: [],
      stateVersion: 1,
    };
    const result = reduceMaisRejectionEvent(createMaisBeliefGraphState(), event);
    expect(result.applied).toBe(true);
    expect(result.state.rejections).toHaveLength(1);
    expect(result.state.rejections[0]).toMatchObject({
      domain: 'training_experiment',
      scope: 'exercise_1',
      reason: 'The proposed load increase felt premature.',
    });
  });
});
