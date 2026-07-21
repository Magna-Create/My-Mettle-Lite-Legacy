import type { MaisArtifactKind, MaisRole } from './contracts';

export interface MaisRoleContentValidation {
  valid: boolean;
  errors: string[];
}

interface RoleContract {
  purpose: string;
  contentExample: Record<string, unknown>;
  requiredKeys: string[];
}

const roleContracts: Record<MaisRole, RoleContract> = {
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
    purpose: 'Specify one reproducible analysis over immutable supplied snapshots. Never request network, filesystem or host access.',
    contentExample: {
      analysisPlan: { question: 'Question', inputRefs: ['snapshot_id'], method: 'bounded deterministic comparison' },
      programme: { language: 'javascript_subset', source: 'return { result: input };', outputSchema: 'AnalysisResultV1' },
      sensitivityChecks: ['repeat with excluded outlier'],
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
  coach: {
    purpose: 'Translate accepted analysis into one reversible proposal. Do not execute or imply approval.',
    contentExample: {
      proposal: {
        type: 'training_experiment',
        rationale: 'Why this test is informative.',
        targetRefs: ['exercise_id'],
        change: {},
        reversible: true,
        successCriteria: ['criterion'],
        stopConditions: ['condition'],
      },
      presentation: { title: 'Short title', summary: 'Plain-language summary.' },
    },
    requiredKeys: ['proposal', 'presentation'],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getMaisRoleContentContract(role: MaisRole): RoleContract {
  return structuredClone(roleContracts[role]);
}

export function formatMaisRoleContentContract(role: MaisRole): string {
  const contract = roleContracts[role];
  return `${contract.purpose} The artifact.content object must follow this compact shape: ${JSON.stringify(contract.contentExample)}`;
}

export function validateMaisRoleContent(role: MaisRole, content: Record<string, unknown>): MaisRoleContentValidation {
  const errors = roleContracts[role].requiredKeys
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
    if (!isRecord(content.programme)) errors.push('artifact.content.programme must be an object.');
    if (!Array.isArray(content.sensitivityChecks)) errors.push('artifact.content.sensitivityChecks must be an array.');
  }
  if (role === 'coach') {
    if (!isRecord(content.proposal)) errors.push('artifact.content.proposal must be an object.');
    if (!isRecord(content.presentation)) errors.push('artifact.content.presentation must be an object.');
  }
  if (role === 'memory_curator') {
    if (!Array.isArray(content.memoryUpdates)) errors.push('artifact.content.memoryUpdates must be an array.');
    if (!Array.isArray(content.unresolvedQuestions)) errors.push('artifact.content.unresolvedQuestions must be an array.');
  }
  if (role === 'research_broker' && !isRecord(content.request)) {
    errors.push('artifact.content.request must be an object.');
  }

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
