import type { MaisArtifactKind, MaisRole } from './contracts';
import { MAIS_ANALYSIS_RECIPE_V2 } from './expandedAnalysisSandbox';

export interface MaisRoleContentValidation {
  valid: boolean;
  errors: string[];
}

interface RoleContract {
  purpose: string;
  contentExample: Record<string, unknown>;
  requiredKeys: string[];
}

const analysisRecipeExample = JSON.stringify({
  schema: MAIS_ANALYSIS_RECIPE_V2,
  steps: [
    { op: 'filter', conditions: [{ field: 'recordKind', equals: 'comparable_exposure' }], as: 'exposures' },
    { op: 'mean', input: 'exposures', field: 'totalEffectiveVolumeKgReps', as: 'meanVolume' },
    { op: 'theil_sen_regression', input: 'exposures', x: 'exposureIndex', y: 'bestEstimatedOneRepMaxKg', as: 'robustTrend' },
  ],
});

const trainingExperimentCoachContract: RoleContract = {
  purpose: 'Translate accepted analysis into one reversible training experiment proposal. Do not execute, activate or imply approval.',
  contentExample: {
    proposal: {
      type: 'training_experiment',
      exerciseId: 'exercise_id_from_packet',
      routineSlotId: 'slot_id_from_packet',
      rationale: 'Why this bounded test is informative.',
      baselineLoad: 40,
      proposedLoad: 42,
      targetRepMin: 6,
      reversible: true,
      successCriteria: ['Complete the target repetitions with clean execution.'],
      stopConditions: ['Stop if comfort is recorded as pain.'],
    },
    presentation: { title: 'Short experiment title', summary: 'Plain-language summary.' },
  },
  requiredKeys: ['proposal', 'presentation'],
};

const experimentDecisionCoachContract: RoleContract = {
  purpose: 'Prepare an inspectable recommendation for a completed experiment. Never apply the decision or imply user approval.',
  contentExample: {
    proposal: {
      type: 'experiment_decision',
      experimentId: 'experiment_id_from_packet',
      recommendation: 'adopt',
      rationale: 'Why the observed result supports this recommendation.',
      evidenceSummary: 'What happened compared with the baseline and success criteria.',
      limitations: ['A limitation or competing explanation.'],
      nextEvidence: ['Evidence required if the recommendation is extend or defer.'],
    },
    presentation: { title: 'Experiment recommendation', summary: 'Plain-language summary.' },
  },
  requiredKeys: ['proposal', 'presentation'],
};

const genericCoachContract: RoleContract = {
  purpose: 'Use proposal.type="experiment_decision" only for MaisExperimentDecisionDraftV1; otherwise use proposal.type="training_experiment". Never execute, activate, adopt or imply user approval.',
  contentExample: {
    trainingExperimentShape: trainingExperimentCoachContract.contentExample,
    experimentDecisionShape: experimentDecisionCoachContract.contentExample,
  },
  requiredKeys: ['proposal', 'presentation'],
};

const roleContracts: Omit<Record<MaisRole, RoleContract>, 'coach'> = {
  governor: {
    purpose: 'Bound the next useful action. Route recognised complexity rather than answering it shallowly.',
    contentExample: {
      route: 'continue',
      reasonCodes: ['direct_evidence_available'],
      scope: { entityRefs: ['session_id'], questions: ['What changed?'] },
      requiredTier: 'standard',
    },
    requiredKeys: ['route', 'reasonCodes', 'scope'],
  },
  analyst: {
    purpose: 'Create or update explicit beliefs from comparable evidence. Separate support, counter-evidence and unresolved questions.',
    contentExample: {
      observations: [{ summary: 'Observed pattern.', provenanceRefs: ['session_id'] }],
      beliefs: [{
        domain: 'exercise_performance',
        claim: 'A bounded hypothesis, not a fact.',
        supportingEvidence: [{ summary: 'Supporting observation.', weight: 0.6, provenanceRefs: ['session_id'] }],
        counterEvidence: [],
        unresolvedQuestions: [{ question: 'What evidence would distinguish alternatives?', priority: 0.6, requiredEvidence: ['two comparable exposures'] }],
      }],
    },
    requiredKeys: ['observations', 'beliefs'],
  },
  coding_analyst: {
    purpose: 'Specify one reproducible analysis over the immutable supplied snapshot. Prefer MaisAnalysisRecipeV2 and compose the supplied deterministic operations. Never emit ordinary JavaScript, Python, network, filesystem or host access. When the catalogue genuinely cannot express a responsible method, include the optional toolSuggestion contract while still providing the safest available bounded programme.',
    contentExample: {
      analysisPlan: { question: 'Question', inputRefs: ['snapshot_id'], method: 'bounded deterministic comparison' },
      programme: {
        language: 'javascript_subset',
        inputSnapshotId: 'snapshot_id_from_packet',
        source: analysisRecipeExample,
        outputSchema: 'MaisAnalysisResultV2',
        permittedLibraries: ['statistics'],
      },
      sensitivityChecks: ['repeat with robust and low-confidence records excluded'],
      toolSuggestion: {
        title: 'Optional missing capability title',
        analyticalQuestion: 'Question the missing method must answer',
        missingCapability: 'Exact missing operation or pipeline',
        reasonExistingToolsFail: 'Why composition is insufficient',
        inputFields: ['fieldName'],
        desiredOutputs: ['resultName'],
        proposedMethod: 'Optional method family',
        assumptions: [],
        minimumEvidence: [],
        requiredTests: ['known synthetic result', 'sparse data'],
        exampleUse: 'Concrete My Mettle use',
        fallbackPreference: 'either',
      },
    },
    requiredKeys: ['analysisPlan', 'programme', 'sensitivityChecks'],
  },
  auditor: {
    purpose: 'Challenge beliefs and analyses independently. Attach support or counter-evidence only to known belief IDs when supplied.',
    contentExample: {
      verdict: 'contested',
      findings: [{
        beliefId: 'belief_id',
        finding: 'Alternative explanation or limitation.',
        polarity: 'counter',
        weight: 0.7,
        provenanceRefs: ['session_id'],
        unresolvedQuestions: [],
      }],
      concerns: ['comparability'],
    },
    requiredKeys: ['verdict', 'findings', 'concerns'],
  },
  memory_curator: {
    purpose: 'Create provenance-linked memory updates without converting one subjective note into a permanent fact.',
    contentExample: {
      memoryUpdates: [{ entityRef: 'exercise_id', summary: 'Bounded memory.', tags: ['setup'], provenanceRefs: ['session_id'] }],
      unresolvedQuestions: [],
    },
    requiredKeys: ['memoryUpdates', 'unresolvedQuestions'],
  },
  research_broker: {
    purpose: 'Draft one precise manual external-research request only when local evidence cannot resolve a decision.',
    contentExample: {
      request: {
        topic: 'Specific topic',
        decisionBlocked: 'Exact blocked decision',
        localContextSummary: 'What local evidence shows',
        questions: [{ question: 'Research question', whyItMatters: 'Decision impact' }],
        preferredEvidence: ['systematic reviews', 'controlled trials'],
        requiredOutputSchema: 'MaisResearchReportV1',
        expectedValue: 0.8,
      },
    },
    requiredKeys: ['request'],
  },
};

function coachContract(outputSchema?: string): RoleContract {
  if (outputSchema === 'MaisExperimentDecisionDraftV1') return experimentDecisionCoachContract;
  if (outputSchema) return trainingExperimentCoachContract;
  return genericCoachContract;
}

function contractFor(role: MaisRole, outputSchema?: string): RoleContract {
  return role === 'coach' ? coachContract(outputSchema) : roleContracts[role];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getMaisRoleContentContract(role: MaisRole, outputSchema?: string): RoleContract {
  return structuredClone(contractFor(role, outputSchema));
}

export function formatMaisRoleContentContract(role: MaisRole, outputSchema?: string): string {
  const contract = contractFor(role, outputSchema);
  return `${contract.purpose} The artifact.content object must follow this compact shape: ${JSON.stringify(contract.contentExample)}`;
}

export function validateMaisRoleContent(
  role: MaisRole,
  content: Record<string, unknown>,
  outputSchema?: string,
): MaisRoleContentValidation {
  const errors = contractFor(role, outputSchema).requiredKeys
    .filter((key) => !(key in content))
    .map((key) => `artifact.content.${key} is required for ${role}.`);

  if (role === 'analyst') {
    if (!Array.isArray(content.observations)) errors.push('artifact.content.observations must be an array.');
    if (!Array.isArray(content.beliefs)) errors.push('artifact.content.beliefs must be an array.');
  }
  if (role === 'auditor') {
    if (!Array.isArray(content.findings)) errors.push('artifact.content.findings must be an array.');
    if (!Array.isArray(content.concerns)) errors.push('artifact.content.concerns must be an array.');
  }
  if (role === 'governor') {
    const routes = new Set(['continue', 'deep_analysis', 'wait', 'stop']);
    if (typeof content.route !== 'string' || !routes.has(content.route)) errors.push('artifact.content.route is invalid.');
    if (!Array.isArray(content.reasonCodes)) errors.push('artifact.content.reasonCodes must be an array.');
    if (!isRecord(content.scope)) errors.push('artifact.content.scope must be an object.');
  }
  if (role === 'coding_analyst') {
    if (!isRecord(content.analysisPlan)) errors.push('artifact.content.analysisPlan must be an object.');
    if (!isRecord(content.programme)) {
      errors.push('artifact.content.programme must be an object.');
    } else {
      if (content.programme.language !== 'javascript_subset') errors.push('artifact.content.programme.language must be javascript_subset.');
      if (typeof content.programme.inputSnapshotId !== 'string') errors.push('artifact.content.programme.inputSnapshotId is required.');
      if (typeof content.programme.source !== 'string') errors.push('artifact.content.programme.source is required.');
      if (typeof content.programme.outputSchema !== 'string') errors.push('artifact.content.programme.outputSchema is required.');
      if (!Array.isArray(content.programme.permittedLibraries)) errors.push('artifact.content.programme.permittedLibraries must be an array.');
    }
    if (!Array.isArray(content.sensitivityChecks)) errors.push('artifact.content.sensitivityChecks must be an array.');
    if (content.toolSuggestion !== undefined && !isRecord(content.toolSuggestion)) errors.push('artifact.content.toolSuggestion must be an object when supplied.');
  }
  if (role === 'coach') {
    if (!isRecord(content.proposal)) {
      errors.push('artifact.content.proposal must be an object.');
    } else {
      const decisionMode = outputSchema === 'MaisExperimentDecisionDraftV1' || content.proposal.type === 'experiment_decision';
      if (decisionMode) {
        const allowed = new Set(['adopt', 'extend', 'reject', 'defer']);
        if (content.proposal.type !== 'experiment_decision') errors.push('artifact.content.proposal.type must be experiment_decision.');
        if (!nonEmpty(content.proposal.experimentId)) errors.push('artifact.content.proposal.experimentId is required.');
        if (typeof content.proposal.recommendation !== 'string' || !allowed.has(content.proposal.recommendation)) errors.push('artifact.content.proposal.recommendation is invalid.');
        if (!nonEmpty(content.proposal.rationale)) errors.push('artifact.content.proposal.rationale is required.');
        if (!nonEmpty(content.proposal.evidenceSummary)) errors.push('artifact.content.proposal.evidenceSummary is required.');
        if (!Array.isArray(content.proposal.limitations)) errors.push('artifact.content.proposal.limitations must be an array.');
        if (!Array.isArray(content.proposal.nextEvidence)) errors.push('artifact.content.proposal.nextEvidence must be an array.');
      } else {
        if (content.proposal.type !== 'training_experiment') errors.push('artifact.content.proposal.type must be training_experiment.');
        if (!nonEmpty(content.proposal.exerciseId)) errors.push('artifact.content.proposal.exerciseId is required.');
        if (!nonEmpty(content.proposal.routineSlotId)) errors.push('artifact.content.proposal.routineSlotId is required.');
        if (!nonEmpty(content.proposal.rationale)) errors.push('artifact.content.proposal.rationale is required.');
        if (!finite(content.proposal.baselineLoad) || content.proposal.baselineLoad < 0) errors.push('artifact.content.proposal.baselineLoad must be non-negative.');
        if (!finite(content.proposal.proposedLoad) || content.proposal.proposedLoad < 0) errors.push('artifact.content.proposal.proposedLoad must be non-negative.');
        if (!finite(content.proposal.targetRepMin) || content.proposal.targetRepMin <= 0) errors.push('artifact.content.proposal.targetRepMin must be positive.');
        if (content.proposal.reversible !== true) errors.push('artifact.content.proposal.reversible must be true.');
        if (!Array.isArray(content.proposal.successCriteria) || content.proposal.successCriteria.length === 0) errors.push('artifact.content.proposal.successCriteria requires at least one criterion.');
        if (!Array.isArray(content.proposal.stopConditions) || content.proposal.stopConditions.length === 0) errors.push('artifact.content.proposal.stopConditions requires at least one condition.');
      }
    }
    if (!isRecord(content.presentation)) {
      errors.push('artifact.content.presentation must be an object.');
    } else {
      if (!nonEmpty(content.presentation.title)) errors.push('artifact.content.presentation.title is required.');
      if (!nonEmpty(content.presentation.summary)) errors.push('artifact.content.presentation.summary is required.');
    }
  }
  if (role === 'memory_curator') {
    if (!Array.isArray(content.memoryUpdates)) errors.push('artifact.content.memoryUpdates must be an array.');
    if (!Array.isArray(content.unresolvedQuestions)) errors.push('artifact.content.unresolvedQuestions must be an array.');
  }
  if (role === 'research_broker' && !isRecord(content.request)) errors.push('artifact.content.request must be an object.');

  return { valid: errors.length === 0, errors };
}

export function expectedArtifactKindForRole(role: MaisRole): MaisArtifactKind {
  switch (role) {
    case 'governor': return 'plan';
    case 'analyst': return 'belief_update';
    case 'coding_analyst': return 'analysis_result';
    case 'auditor': return 'audit';
    case 'coach': return 'lab_proposal_draft';
    case 'memory_curator': return 'memory_update';
    case 'research_broker': return 'research_request';
  }
}
