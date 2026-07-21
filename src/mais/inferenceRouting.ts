export type MaisInferenceRoute = 'deterministic' | 'everyday_language' | 'deep_reasoning' | 'language_triage';

export type MaisInferenceOperation =
  | 'format'
  | 'extract'
  | 'summarise_single_record'
  | 'explain_known_result'
  | 'compare_history'
  | 'causal_analysis'
  | 'experiment_design'
  | 'experiment_evaluation'
  | 'routine_change'
  | 'widget_code'
  | 'unknown';

export interface MaisInferenceSignals {
  operation: MaisInferenceOperation;
  evidenceSourceCount?: number | undefined;
  hasContradictoryEvidence?: boolean | undefined;
  priorAttemptUncertain?: boolean | undefined;
  consequence?: 'low' | 'medium' | 'high' | undefined;
  userDepth?: 'quick' | 'automatic' | 'deep' | undefined;
}

export interface MaisInferenceDecision {
  route: MaisInferenceRoute;
  score: number;
  reasonCodes: string[];
}

const deterministicOperations = new Set<MaisInferenceOperation>(['format', 'extract']);
const everydayOperations = new Set<MaisInferenceOperation>(['summarise_single_record', 'explain_known_result']);
const deepOperations = new Set<MaisInferenceOperation>([
  'causal_analysis',
  'experiment_design',
  'experiment_evaluation',
  'routine_change',
  'widget_code',
]);

/**
 * Routes work before a model is loaded. Obvious work is decided by code;
 * E2B is used only to triage genuinely ambiguous requests; Qwen owns recognised
 * deep reasoning. This prevents the everyday model becoming the sole gatekeeper.
 */
export function routeMaisInference(signals: MaisInferenceSignals): MaisInferenceDecision {
  const reasonCodes: string[] = [];

  if (signals.userDepth === 'deep') {
    return { route: 'deep_reasoning', score: 100, reasonCodes: ['user_requested_deep'] };
  }

  if (deterministicOperations.has(signals.operation)) {
    return { route: 'deterministic', score: -100, reasonCodes: ['deterministic_operation'] };
  }

  let score = 0;

  if (deepOperations.has(signals.operation)) {
    score += 4;
    reasonCodes.push('deep_operation');
  }

  if (signals.operation === 'compare_history') {
    score += 2;
    reasonCodes.push('longitudinal_comparison');
  }

  const evidenceSourceCount = Math.max(0, signals.evidenceSourceCount ?? 0);
  if (evidenceSourceCount >= 3) {
    score += 2;
    reasonCodes.push('multiple_evidence_sources');
  } else if (evidenceSourceCount === 2) {
    score += 1;
    reasonCodes.push('two_evidence_sources');
  }

  if (signals.hasContradictoryEvidence) {
    score += 2;
    reasonCodes.push('contradictory_evidence');
  }

  if (signals.priorAttemptUncertain) {
    score += 2;
    reasonCodes.push('prior_uncertainty');
  }

  if (signals.consequence === 'high') {
    score += 2;
    reasonCodes.push('high_consequence');
  } else if (signals.consequence === 'medium') {
    score += 1;
    reasonCodes.push('medium_consequence');
  }

  if (signals.userDepth === 'quick') {
    score -= 2;
    reasonCodes.push('user_requested_quick');
  }

  if (score >= 4) return { route: 'deep_reasoning', score, reasonCodes };
  if (everydayOperations.has(signals.operation) || score <= 0) {
    return { route: 'everyday_language', score, reasonCodes: reasonCodes.length ? reasonCodes : ['everyday_operation'] };
  }

  return { route: 'language_triage', score, reasonCodes: [...reasonCodes, 'ambiguous_complexity'] };
}
