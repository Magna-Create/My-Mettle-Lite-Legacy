import type { Exercise } from '../domain/model';

export const MAIS_MUSCLE_ONTOLOGY_VERSION = 1;

export type MaisBodyRegion = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'hips' | 'legs' | 'calves';
export type MaisMuscleNodeKind = 'region_group' | 'muscle_group' | 'muscle';
export type MaisMuscleContributionRole = 'primary' | 'secondary' | 'stabiliser';

export interface MaisMuscleNode {
  id: string;
  label: string;
  region: MaisBodyRegion;
  kind: MaisMuscleNodeKind;
  parentId?: string | undefined;
  aliases: string[];
}

export interface MaisExerciseMuscleContribution {
  muscleId: string;
  role: MaisMuscleContributionRole;
  weight: number;
  source: 'explicit' | 'legacy_target_muscles' | 'model_proposal';
  ontologyVersion: typeof MAIS_MUSCLE_ONTOLOGY_VERSION;
}

export interface MaisResolvedExerciseMuscles {
  contributions: MaisExerciseMuscleContribution[];
  unresolvedLabels: string[];
}

const nodes: MaisMuscleNode[] = [
  { id: 'chest', label: 'Chest', region: 'chest', kind: 'region_group', aliases: ['pecs', 'pectoral'] },
  { id: 'pectoralis_major_clavicular', label: 'Upper chest', region: 'chest', kind: 'muscle', parentId: 'chest', aliases: ['clavicular pec', 'clavicular chest'] },
  { id: 'pectoralis_major_sternocostal', label: 'Mid and lower chest', region: 'chest', kind: 'muscle', parentId: 'chest', aliases: ['mid chest', 'lower chest', 'sternal pec'] },

  { id: 'back', label: 'Back', region: 'back', kind: 'region_group', aliases: [] },
  { id: 'upper_back', label: 'Upper back', region: 'back', kind: 'muscle_group', parentId: 'back', aliases: ['upper-back'] },
  { id: 'latissimus_dorsi', label: 'Lats', region: 'back', kind: 'muscle', parentId: 'back', aliases: ['lat', 'latissimus', 'latissimus dorsi'] },
  { id: 'trapezius_upper', label: 'Upper traps', region: 'back', kind: 'muscle', parentId: 'upper_back', aliases: ['upper trapezius'] },
  { id: 'trapezius_middle_lower', label: 'Mid and lower traps', region: 'back', kind: 'muscle_group', parentId: 'upper_back', aliases: ['mid traps', 'lower traps', 'middle trapezius', 'lower trapezius'] },
  { id: 'rhomboids', label: 'Rhomboids', region: 'back', kind: 'muscle', parentId: 'upper_back', aliases: ['rhomboid'] },
  { id: 'erector_spinae', label: 'Spinal erectors', region: 'back', kind: 'muscle_group', parentId: 'back', aliases: ['erectors', 'lower back'] },

  { id: 'shoulders', label: 'Shoulders', region: 'shoulders', kind: 'region_group', aliases: ['delts', 'deltoids'] },
  { id: 'deltoid_anterior', label: 'Front delts', region: 'shoulders', kind: 'muscle', parentId: 'shoulders', aliases: ['front delt', 'anterior deltoid', 'anterior delts'] },
  { id: 'deltoid_lateral', label: 'Side delts', region: 'shoulders', kind: 'muscle', parentId: 'shoulders', aliases: ['side delt', 'lateral deltoid', 'lateral delts', 'middle delts'] },
  { id: 'deltoid_posterior', label: 'Rear delts', region: 'shoulders', kind: 'muscle', parentId: 'shoulders', aliases: ['rear delt', 'posterior deltoid', 'posterior delts'] },

  { id: 'arms', label: 'Arms', region: 'arms', kind: 'region_group', aliases: [] },
  { id: 'biceps_brachii', label: 'Biceps', region: 'arms', kind: 'muscle', parentId: 'arms', aliases: ['biceps brachii'] },
  { id: 'brachialis_brachioradialis', label: 'Elbow flexors', region: 'arms', kind: 'muscle_group', parentId: 'arms', aliases: ['brachialis', 'brachioradialis'] },
  { id: 'triceps_brachii', label: 'Triceps', region: 'arms', kind: 'muscle', parentId: 'arms', aliases: ['triceps brachii'] },
  { id: 'forearms', label: 'Forearms', region: 'arms', kind: 'muscle_group', parentId: 'arms', aliases: ['grip'] },

  { id: 'core', label: 'Core', region: 'core', kind: 'region_group', aliases: ['trunk'] },
  { id: 'rectus_abdominis', label: 'Abs', region: 'core', kind: 'muscle', parentId: 'core', aliases: ['abdominals', 'rectus abdominis'] },
  { id: 'obliques', label: 'Obliques', region: 'core', kind: 'muscle_group', parentId: 'core', aliases: ['side abs'] },

  { id: 'hips', label: 'Hips', region: 'hips', kind: 'region_group', aliases: [] },
  { id: 'gluteus_maximus', label: 'Glutes', region: 'hips', kind: 'muscle', parentId: 'hips', aliases: ['glute', 'glute max', 'gluteus maximus'] },
  { id: 'gluteus_medius_minimus', label: 'Hip abductors', region: 'hips', kind: 'muscle_group', parentId: 'hips', aliases: ['glute med', 'gluteus medius', 'abductors'] },
  { id: 'hip_adductors', label: 'Adductors', region: 'hips', kind: 'muscle_group', parentId: 'hips', aliases: ['inner thigh', 'hip adductors'] },
  { id: 'hip_flexors', label: 'Hip flexors', region: 'hips', kind: 'muscle_group', parentId: 'hips', aliases: ['iliopsoas'] },

  { id: 'legs', label: 'Legs', region: 'legs', kind: 'region_group', aliases: [] },
  { id: 'quadriceps', label: 'Quads', region: 'legs', kind: 'muscle_group', parentId: 'legs', aliases: ['quad', 'quadriceps'] },
  { id: 'hamstrings', label: 'Hamstrings', region: 'legs', kind: 'muscle_group', parentId: 'legs', aliases: ['hamstring'] },

  { id: 'calves', label: 'Calves', region: 'calves', kind: 'region_group', aliases: ['calf'] },
  { id: 'gastrocnemius', label: 'Gastrocnemius', region: 'calves', kind: 'muscle', parentId: 'calves', aliases: ['gastroc'] },
  { id: 'soleus', label: 'Soleus', region: 'calves', kind: 'muscle', parentId: 'calves', aliases: [] },
];

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

const aliasIndex = new Map<string, MaisMuscleNode>();
for (const node of nodes) {
  for (const alias of [node.id, node.label, ...node.aliases]) aliasIndex.set(normalise(alias), node);
}

export function getMaisMuscleOntology(): MaisMuscleNode[] {
  return structuredClone(nodes);
}

export function getMaisMuscleNode(id: string): MaisMuscleNode | null {
  const node = nodes.find((candidate) => candidate.id === id);
  return node ? structuredClone(node) : null;
}

export function resolveMaisMuscleLabel(label: string): MaisMuscleNode | null {
  const node = aliasIndex.get(normalise(label));
  return node ? structuredClone(node) : null;
}

export function normaliseMuscleContributions(
  contributions: Omit<MaisExerciseMuscleContribution, 'ontologyVersion'>[],
): MaisExerciseMuscleContribution[] {
  const merged = new Map<string, Omit<MaisExerciseMuscleContribution, 'ontologyVersion'>>();
  for (const contribution of contributions) {
    if (!nodes.some((node) => node.id === contribution.muscleId)) throw new Error(`Unknown muscle ontology ID ${contribution.muscleId}.`);
    if (!Number.isFinite(contribution.weight) || contribution.weight < 0) throw new Error('Muscle contribution weight must be a non-negative finite number.');
    const existing = merged.get(contribution.muscleId);
    if (!existing || contribution.weight > existing.weight) merged.set(contribution.muscleId, structuredClone(contribution));
  }
  const values = [...merged.values()].filter((contribution) => contribution.weight > 0);
  const total = values.reduce((sum, contribution) => sum + contribution.weight, 0);
  if (total <= 0) return [];
  return values
    .map((contribution) => ({ ...contribution, weight: contribution.weight / total, ontologyVersion: MAIS_MUSCLE_ONTOLOGY_VERSION }))
    .sort((left, right) => right.weight - left.weight || left.muscleId.localeCompare(right.muscleId));
}

export function resolveExerciseMuscleContributions(exercise: Exercise): MaisResolvedExerciseMuscles {
  const labels = exercise.memory?.targetMuscles ?? [];
  const resolved = labels.flatMap((label) => {
    const node = resolveMaisMuscleLabel(label);
    return node ? [{ label, node }] : [];
  });
  const unresolvedLabels = labels.filter((label) => !resolveMaisMuscleLabel(label));
  const equalWeight = resolved.length > 0 ? 1 / resolved.length : 0;
  return {
    contributions: normaliseMuscleContributions(resolved.map(({ node }) => ({
      muscleId: node.id,
      role: 'primary',
      weight: equalWeight,
      source: 'legacy_target_muscles',
    }))),
    unresolvedLabels,
  };
}

export function aggregateMuscleContributions(
  exerciseContributions: Array<{ exposureWeight: number; contributions: MaisExerciseMuscleContribution[] }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of exerciseContributions) {
    if (!Number.isFinite(item.exposureWeight) || item.exposureWeight < 0) throw new Error('Exposure weight must be a non-negative finite number.');
    for (const contribution of item.contributions) {
      totals.set(contribution.muscleId, (totals.get(contribution.muscleId) ?? 0) + item.exposureWeight * contribution.weight);
    }
  }
  return totals;
}
