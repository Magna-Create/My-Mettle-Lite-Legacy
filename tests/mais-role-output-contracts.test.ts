import { describe, expect, it } from 'vitest';
import { expectedArtifactKindForRole, formatMaisRoleContentContract, getMaisRoleContentContract, validateMaisRoleContent } from '../src/mais/roleOutputContracts';

describe('MAIS role output contracts', () => {
  it('maps every role to its fixed Workbench artefact kind', () => {
    expect(expectedArtifactKindForRole('governor')).toBe('plan');
    expect(expectedArtifactKindForRole('analyst')).toBe('belief_update');
    expect(expectedArtifactKindForRole('coding_analyst')).toBe('analysis_result');
    expect(expectedArtifactKindForRole('auditor')).toBe('audit');
    expect(expectedArtifactKindForRole('coach')).toBe('lab_proposal_draft');
    expect(expectedArtifactKindForRole('memory_curator')).toBe('memory_update');
    expect(expectedArtifactKindForRole('research_broker')).toBe('research_request');
  });

  it('accepts each published non-Coach example and returns defensive clones', () => {
    const roles = ['governor', 'analyst', 'coding_analyst', 'auditor', 'memory_curator', 'research_broker'] as const;
    for (const role of roles) {
      const contract = getMaisRoleContentContract(role);
      expect(validateMaisRoleContent(role, contract.contentExample)).toEqual({ valid: true, errors: [] });
      expect(formatMaisRoleContentContract(role)).toContain('artifact.content');
      contract.requiredKeys.push('mutated');
      expect(getMaisRoleContentContract(role).requiredKeys).not.toContain('mutated');
    }
  });

  it('validates both concrete Coach schemas independently', () => {
    const experiment = getMaisRoleContentContract('coach', 'MaisTrainingExperimentDraftV1');
    expect(validateMaisRoleContent('coach', experiment.contentExample, 'MaisTrainingExperimentDraftV1')).toEqual({ valid: true, errors: [] });
    const decision = getMaisRoleContentContract('coach', 'MaisExperimentDecisionDraftV1');
    expect(validateMaisRoleContent('coach', decision.contentExample, 'MaisExperimentDecisionDraftV1')).toEqual({ valid: true, errors: [] });
    expect(formatMaisRoleContentContract('coach')).toContain('experiment_decision');
  });

  it('rejects generic untyped JSON for analytical roles', () => {
    expect(validateMaisRoleContent('analyst', { answer: 'probably fatigue' }).valid).toBe(false);
    expect(validateMaisRoleContent('auditor', { verdict: 'fine' }).errors.join(' ')).toMatch(/findings/i);
    expect(validateMaisRoleContent('governor', { route: 'guess', reasonCodes: [], scope: {} }).errors.join(' ')).toMatch(/route is invalid/i);
  });
});
