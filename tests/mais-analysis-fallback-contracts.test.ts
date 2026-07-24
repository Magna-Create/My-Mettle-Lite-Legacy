import { describe, expect, it } from 'vitest';
import { benchmarkMaisAnalysisContext, selectLargestAnalysisContextWithinBudget } from '../src/mais/analysisContextBenchmark';
import { restrictedPythonRuntimeStatus, validateMaisRestrictedPythonProgramme, type MaisRestrictedPythonProgrammeV1 } from '../src/mais/restrictedPythonContract';

describe('MAIS analysis fallback contracts', () => {
  it('benchmarks 48, 96, 160 and 256-row context packets without executing a model', () => {
    const records = Array.from({ length: 300 }, (_, index) => ({ recordKind: index % 2 ? 'exposure' : 'heart_rate_set', index, value: index * 2 }));
    const results = benchmarkMaisAnalysisContext(records);
    expect(results.map((result) => result.recordLimit)).toEqual([48, 96, 160, 256]);
    expect(results[3]).toMatchObject({ includedRecords: 256, omittedRecords: 44 });
    expect(selectLargestAnalysisContextWithinBudget(results, results[1]!.estimatedTokens)?.recordLimit).toBe(96);
  });

  it('defines but does not enable the restricted Python runtime', () => {
    expect(restrictedPythonRuntimeStatus()).toMatchObject({ available: false, contractVersion: 1 });
  });

  it('validates declared tests, limits and prohibited access', () => {
    const programme: MaisRestrictedPythonProgrammeV1 = {
      schema: 'MaisRestrictedPythonProgrammeV1',
      contractVersion: 1,
      question: 'Fit an unusual bounded curve.',
      reasonDeterministicToolsAreInsufficient: 'No approved nonlinear fit exists yet.',
      inputSnapshotId: 'snapshot_1',
      expectedInputFields: ['x', 'y'],
      expectedOutputFields: ['parameter'],
      assumptions: ['bounded monotonic signal'],
      missingDataPolicy: 'drop rows with missing x or y',
      minimumRecordCount: 8,
      permittedModules: ['numpy', 'scipy.stats'],
      source: 'import numpy as np\nresult = {"parameter": float(np.mean([1, 2]))}',
      tests: [
        { name: 'known signal', inputRecords: [{ x: 1, y: 2 }], expected: { parameter: 1.5 } },
        { name: 'missing data', inputRecords: [{ x: 1, y: null }], expected: { parameter: null } },
      ],
      randomSeed: 7,
      limits: { cpuMs: 2_000, memoryMb: 256, outputBytes: 50_000 },
    };
    expect(validateMaisRestrictedPythonProgramme(programme, 'snapshot_1').valid).toBe(true);
    const unsafe = { ...programme, source: 'import requests\nrequests.get("https://example.com")' };
    const result = validateMaisRestrictedPythonProgramme(unsafe, 'snapshot_1');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/network access/i);
  });
});
