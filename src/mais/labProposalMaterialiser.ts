import type { AppDatabase, Experiment, RoutineSlot } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import type { MaisLabProposal, MaisLabProposalState } from './labProposalState';

export interface MaisLabMaterialisation {
  database: AppDatabase;
  materialised: Array<{ proposalId: string; experimentId: string }>;
  diagnostics: string[];
}

function findSlot(database: AppDatabase, proposal: MaisLabProposal): RoutineSlot | null {
  const routine = database.routineVersions.find((candidate) => candidate.id === database.currentRoutineVersionId);
  if (!routine) return null;
  if (proposal.routineSlotId) {
    const explicit = routine.days.flatMap((day) => day.slots).find((slot) => slot.id === proposal.routineSlotId);
    if (explicit) return explicit;
  }
  return routine.days.flatMap((day) => day.slots).find((slot) => slot.exerciseId === proposal.exerciseId) ?? null;
}

function targetRepMin(slot: RoutineSlot, requested?: number): number {
  if (requested !== undefined && Number.isFinite(requested) && requested > 0) return Math.round(requested);
  const included = Object.values(slot.prescriptions).filter((prescription) => prescription.included);
  return included.length ? Math.min(...included.map((prescription) => prescription.repMin)) : 1;
}

export function materialiseMaisLabProposals(
  database: AppDatabase,
  state: MaisLabProposalState,
): MaisLabMaterialisation {
  const materialised: Array<{ proposalId: string; experimentId: string }> = [];
  const diagnostics: string[] = [];
  const additions: Experiment[] = [];

  for (const proposal of state.proposals.filter((candidate) => candidate.status === 'ready')) {
    const experimentId = `experiment_${proposal.id}`;
    if (database.experiments.some((experiment) => experiment.id === experimentId)) {
      materialised.push({ proposalId: proposal.id, experimentId });
      continue;
    }
    const exercise = database.exercises.find((candidate) => candidate.id === proposal.exerciseId && !candidate.archived);
    const slot = findSlot(database, proposal);
    if (!exercise || !slot) {
      diagnostics.push(`${proposal.title} could not enter Lab because its current exercise or routine slot was not found.`);
      continue;
    }
    if (exercise.tracking.metric !== 'load_reps' || exercise.tracking.loadRelationship === 'bodyweight' || exercise.tracking.loadRelationship === 'none') {
      diagnostics.push(`${proposal.title} requires a load-based exercise supported by the current Lab experiment schema.`);
      continue;
    }
    if (database.experiments.some((experiment) => experiment.routineSlotId === slot.id && ['proposed', 'active', 'ready_for_decision'].includes(experiment.status))) {
      diagnostics.push(`${proposal.title} was held because another experiment is already open for ${exercise.name}.`);
      continue;
    }

    const baselineLoad = proposal.baselineLoad ?? slot.plannedLoad;
    if (!Number.isFinite(baselineLoad) || !Number.isFinite(proposal.proposedLoad) || baselineLoad === proposal.proposedLoad) {
      diagnostics.push(`${proposal.title} did not contain a meaningful load change.`);
      continue;
    }
    const criteria = proposal.successCriteria.length
      ? ` Success: ${proposal.successCriteria.join('; ')}.`
      : '';
    const stops = proposal.stopConditions.length
      ? ` Stop if: ${proposal.stopConditions.join('; ')}.`
      : '';
    additions.push({
      id: experimentId,
      exerciseId: exercise.id,
      routineSlotId: slot.id,
      exerciseName: exercise.name,
      hypothesis: proposal.rationale,
      baselineLoad,
      proposedLoad: proposal.proposedLoad,
      targetRepMin: targetRepMin(slot, proposal.targetRepMin),
      status: 'proposed',
      createdAt: proposal.createdAt,
      evidenceSummary: `${proposal.summary}${criteria}${stops} Source: ${proposal.sourceArtifactId}.`,
      schemaVersion: SCHEMA_VERSION,
    });
    materialised.push({ proposalId: proposal.id, experimentId });
  }

  return {
    database: additions.length ? { ...database, experiments: [...database.experiments, ...additions] } : database,
    materialised,
    diagnostics,
  };
}
