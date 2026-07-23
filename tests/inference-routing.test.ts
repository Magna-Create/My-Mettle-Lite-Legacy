import { describe, expect, it } from 'vitest';
import { routeMaisInference } from '../src/mais/inferenceRouting';
import { capabilityForRole, selectMaisModel } from '../src/mais/modelLeases';

describe('MAIS deterministic inference routing', () => {
  it('keeps formatting and extraction out of model inference', () => {
    expect(routeMaisInference({ operation: 'format' }).route).toBe('deterministic');
    expect(routeMaisInference({ operation: 'extract' }).route).toBe('deterministic');
  });

  it('routes obvious everyday language work to E2B capability', () => {
    const decision = routeMaisInference({
      operation: 'summarise_single_record',
      evidenceSourceCount: 1,
      consequence: 'low',
    });
    expect(decision.route).toBe('everyday_language');
  });

  it('routes recognised complex work directly to deep reasoning', () => {
    const decision = routeMaisInference({
      operation: 'experiment_design',
      evidenceSourceCount: 4,
      hasContradictoryEvidence: true,
      consequence: 'medium',
    });
    expect(decision.route).toBe('deep_reasoning');
    expect(decision.reasonCodes).toContain('deep_operation');
  });

  it('uses E2B only to triage ambiguous middle cases', () => {
    const decision = routeMaisInference({
      operation: 'compare_history',
      evidenceSourceCount: 1,
      consequence: 'low',
    });
    expect(decision.route).toBe('language_triage');
  });
});

describe('MAIS capability-based model topology', () => {
  it('uses E2B for standard analyst work and Qwen3-4B for deep analyst work', () => {
    expect(capabilityForRole('analyst', 'standard')).toBe('everyday_language');
    expect(selectMaisModel('analyst', 'standard').modelId).toBe('google.gemma-4-e2b-it');
    expect(capabilityForRole('analyst', 'deep')).toBe('deep_reasoning');
    expect(selectMaisModel('analyst', 'deep').modelId).toBe('qwen.qwen3-4b');
  });

  it('keeps retrieval isolated to EmbeddingGemma', () => {
    expect(capabilityForRole('retrieval', 'light')).toBe('retrieval');
    expect(selectMaisModel('retrieval', 'light').modelId).toBe('google.embeddinggemma');
  });
});
