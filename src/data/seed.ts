import { createId } from '../domain/ids';
import type {
  AppDatabase,
  DaySymbol,
  EntryBasis,
  Exercise,
  Importance,
  Mode,
  ModePrescription,
  RoutineDay,
  RoutineSlot,
} from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';
import { EMPTY_EXERCISE_MEMORY } from '../domain/exerciseMemory';
import { trackingFromPreset, type TrackingPreset } from '../domain/tracking';

const now = () => new Date().toISOString();

function prescription(
  mode: Mode,
  sets: number,
  repMin: number,
  repMax: number,
  restSeconds: number,
  included = true,
): ModePrescription {
  return {
    mode,
    sets,
    repMin,
    repMax,
    restSeconds,
    included,
    deferToAnd: mode !== 'A',
  };
}

function exercise(
  name: string,
  progressionStep: number,
  cue: string,
  preset: TrackingPreset = 'external_load',
  entryBasis: EntryBasis = 'total',
  memory: Partial<Exercise['memory']> = {},
): Exercise {
  const timestamp = now();
  return {
    id: createId('exercise'),
    name,
    archived: false,
    defaultUnit: 'kg',
    tracking: trackingFromPreset(preset, entryBasis),
    progressionStep,
    essentialCue: cue,
    memory: {
      ...EMPTY_EXERCISE_MEMORY,
      ...memory,
      cues: memory.cues ?? [cue],
      targetMuscles: memory.targetMuscles ?? [],
      commonMistakes: memory.commonMistakes ?? [],
      substitutions: memory.substitutions ?? [],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: SCHEMA_VERSION,
  };
}

function slot(
  exerciseId: string,
  position: number,
  importance: Importance,
  plannedLoad: number,
  a: [number, number, number, number],
  b: [number, number, number, number],
  c: [number, number, number, number],
): RoutineSlot {
  return {
    id: createId('slot'),
    exerciseId,
    position,
    importance,
    plannedLoad,
    lockedToDay: importance === 'principal',
    prescriptions: {
      A: prescription('A', ...a),
      B: prescription('B', ...b),
      C: prescription('C', ...c),
    },
  };
}

export function createSeedDatabase(): AppDatabase {
  const timestamp = now();
  const inclinePress = exercise(
    'Incline dumbbell press',
    2,
    'Set the shoulder blades, then drive without losing the upper-back shelf.',
    'external_load',
    'per_hand',
    {
      category: 'Press',
      equipment: 'Dumbbells and adjustable bench',
      targetMuscles: ['Upper chest', 'Front delts', 'Triceps'],
      machineSettings: 'Record bench angle used.',
      substitutions: ['Incline machine press', 'Low-incline Smith press'],
    },
  );
  const row = exercise('Chest-supported row', 2, 'Pull through the elbow and keep the ribcage quiet.', 'external_load', 'total', {
    category: 'Row',
    equipment: 'Chest-supported row machine',
    targetMuscles: ['Upper back', 'Lats', 'Rear delts'],
    substitutions: ['Seal row', 'Cable row'],
  });
  const squat = exercise('Hack squat', 5, 'Own the bottom position; do not trade depth for the final rep.', 'external_load', 'total', {
    category: 'Squat',
    equipment: 'Hack squat machine',
    targetMuscles: ['Quads', 'Glutes'],
    commonMistakes: ['Shortening depth as fatigue rises'],
    machineSettings: 'Record foot position and sled setting.',
    substitutions: ['Leg press', 'Smith squat'],
  });
  const pulldown = exercise('Neutral-grip pulldown', 2.5, 'Let the shoulder blade rise, then pull it down before bending the elbow.', 'external_load', 'total', {
    category: 'Vertical pull',
    equipment: 'Cable stack and neutral handle',
    targetMuscles: ['Lats', 'Upper back', 'Biceps'],
    substitutions: ['Assisted pull-up', 'Single-arm pulldown'],
  });
  const lateralRaise = exercise(
    'Cable lateral raise',
    1,
    'Lead with the elbow and stop before the trap takes over.',
    'external_load',
    'per_side',
    {
      category: 'Isolation',
      equipment: 'Cable stack and cuff/handle',
      targetMuscles: ['Side delts'],
      machineSettings: 'Record cable height and attachment.',
      substitutions: ['Dumbbell lateral raise', 'Machine lateral raise'],
    },
  );
  const curl = exercise(
    'Incline dumbbell curl',
    1,
    'Keep the upper arm behind the torso throughout.',
    'external_load',
    'per_hand',
    {
      category: 'Isolation',
      equipment: 'Dumbbells and adjustable bench',
      targetMuscles: ['Biceps'],
      machineSettings: 'Record bench angle.',
      substitutions: ['Bayesian cable curl', 'Preacher curl'],
    },
  );

  const exercises = [inclinePress, row, squat, pulldown, lateralRaise, curl];

  const days: RoutineDay[] = [
    {
      symbol: 'ψ',
      slots: [
        slot(inclinePress.id, 0, 'principal', 20, [3, 6, 7, 150], [2, 6, 7, 150], [1, 6, 7, 150]),
        slot(row.id, 1, 'core', 35, [3, 6, 8, 120], [2, 6, 8, 120], [1, 6, 8, 120]),
      ],
    },
    {
      symbol: 'φ',
      slots: [
        slot(squat.id, 0, 'principal', 60, [3, 6, 7, 180], [2, 6, 7, 180], [1, 6, 7, 180]),
        slot(lateralRaise.id, 1, 'accessory', 7.5, [3, 8, 12, 75], [2, 8, 12, 75], [1, 8, 12, 75]),
      ],
    },
    {
      symbol: 'π',
      slots: [
        slot(pulldown.id, 0, 'principal', 40, [3, 6, 8, 150], [2, 6, 8, 150], [1, 6, 8, 150]),
        slot(curl.id, 1, 'accessory', 10, [3, 8, 10, 90], [2, 8, 10, 90], [1, 8, 10, 90]),
      ],
    },
    { symbol: '&', slots: [] },
  ];

  const routineVersionId = createId('routine_version');
  const cycleId = createId('cycle');

  return {
    profile: {
      id: createId('profile'),
      displayName: 'Kian',
      units: 'kg',
      dietaryPreference: 'vegetarian',
      cycleStartDay: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    },
    settings: {
      restTimer: {
        autoStart: true,
        vibrationEnabled: true,
        vibrationStrength: 'strong',
        chimeEnabled: false,
        backgroundNotificationEnabled: true,
      },
      schemaVersion: SCHEMA_VERSION,
    },
    bodyMeasurements: [],
    exercises,
    routineVersions: [
      {
        id: routineVersionId,
        version: 1,
        createdAt: timestamp,
        effectiveAt: timestamp,
        source: 'seed',
        changeReason: 'Phase 2 development seed routine',
        days,
        schemaVersion: SCHEMA_VERSION,
      },
    ],
    currentRoutineVersionId: routineVersionId,
    sessions: [],
    cycles: [
      {
        id: cycleId,
        startedAt: timestamp,
        status: 'active',
        completedCoreDays: [],
        andCompleted: false,
        schemaVersion: SCHEMA_VERSION,
      },
    ],
    currentCycleId: cycleId,
    activeSessionId: null,
    experiments: [],
    healthObservations: [],
    healthIntegration: {
      provider: 'none',
      permissionState: 'not_requested',
      schemaVersion: SCHEMA_VERSION,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: SCHEMA_VERSION,
  };
}

export const DAY_LABELS: Record<DaySymbol, string> = {
  ψ: 'Core day ψ',
  φ: 'Core day φ',
  π: 'Core day π',
  '&': 'Catch-up day &',
};