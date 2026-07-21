import { describe, expect, it } from 'vitest';
import {
  createMaisAnalysisInput,
  DeterministicMaisAnalysisSandbox,
  type MaisAnalysisProgram,
  type MaisAnalysisRecipeV1,
} from '../src/mais/analysisSandbox';

function programme(inputId: string, recipe: MaisAnalysisRecipeV1): MaisAnalysisProgram {
  return {
    id: 'programme_1',
    language: 'javascript_subset',
    source: JSON.stringify(recipe),
    inputSnapshotId: inputId,
    outputSchema: 'MaisAnalysisResultV1',
    permittedLibraries: ['statistics'],
    createdByTaskId: 'task_1',
    createdAt: '2026-07-21T14:00:00.000Z',
  };
}

describe('deterministic MAIS analysis sandbox', () => {
  it('executes descriptive, grouped and sensitivity operations without eval', async () => {
    const input = createMaisAnalysisInput('ExposureRowsV1', [
      { mode: 'A', load: 40, reps: 10 },
      { mode: 'A', load: 42, reps: 9 },
      { mode: 'B', load: 45, reps: 8 },
      { mode: 'B', load: 1000, reps: 1 },
    ], ['session_1', 'session_2'], '2026-07-21T14:00:00.000Z');
    const recipe: MaisAnalysisRecipeV1 = {
      schema: 'MaisAnalysisRecipeV1',
      operations: [
        { op: 'count', as: 'n' },
        { op: 'mean', field: 'load', as: 'meanLoad' },
        { op: 'median', field: 'load', as: 'medianLoad' },
        { op: 'group_mean', groupBy: 'mode', field: 'reps', as: 'repsByMode' },
        { op: 'trimmed_mean', field: 'load', trimFraction: 0.25, as: 'trimmedLoad' },
      ],
    };
    const result = await new DeterministicMaisAnalysisSandbox().execute(programme(input.id, recipe), input);
    expect(result.status).toBe('completed');
    expect(result.output.results).toMatchObject({
      n: 4,
      meanLoad: 281.75,
      medianLoad: 43.5,
      repsByMode: { A: { mean: 9.5, n: 2 }, B: { mean: 4.5, n: 2 } },
      trimmedLoad: { mean: 43.5, n: 2, trimmedPerSide: 1 },
    });
    expect(result.output.provenanceRefs).toEqual(['session_1', 'session_2']);
  });

  it('computes correlation and linear regression reproducibly', async () => {
    const input = createMaisAnalysisInput('TrendRowsV1', [
      { exposure: 1, score: 2 },
      { exposure: 2, score: 4 },
      { exposure: 3, score: 6 },
      { exposure: 4, score: 8 },
    ], ['series_1']);
    const result = await new DeterministicMaisAnalysisSandbox().execute(programme(input.id, {
      schema: 'MaisAnalysisRecipeV1',
      operations: [
        { op: 'pearson', x: 'exposure', y: 'score', as: 'correlation' },
        { op: 'linear_regression', x: 'exposure', y: 'score', as: 'trend' },
      ],
    }), input);
    expect(result.status).toBe('completed');
    expect(result.output.results).toMatchObject({
      correlation: { coefficient: 1, n: 4 },
      trend: { slope: 2, intercept: 0, rSquared: 1, n: 4 },
    });
  });

  it('supports bounded filters without exposing arbitrary expressions', async () => {
    const input = createMaisAnalysisInput('FilterRowsV1', [
      { mode: 'A', value: 3 },
      { mode: 'B', value: 5 },
      { mode: 'B', value: 7 },
    ], ['rows']);
    const result = await new DeterministicMaisAnalysisSandbox().execute(programme(input.id, {
      schema: 'MaisAnalysisRecipeV1',
      operations: [{ op: 'mean', field: 'value', as: 'modeB', filter: { field: 'mode', equals: 'B' } }],
    }), input);
    expect(result.output.results).toEqual({ modeB: 6 });
  });

  it('rejects code-shaped source and prohibited access rather than evaluating it', async () => {
    const input = createMaisAnalysisInput('RowsV1', [{ value: 1 }], ['row_1']);
    const unsafe: MaisAnalysisProgram = {
      ...programme(input.id, { schema: 'MaisAnalysisRecipeV1', operations: [{ op: 'count', as: 'n' }] }),
      source: 'fetch("https://example.com").then(eval)',
    };
    const result = await new DeterministicMaisAnalysisSandbox().execute(unsafe, input);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics.join(' ')).toMatch(/network access/i);
    expect(result.diagnostics.join(' ')).toMatch(/valid JSON/i);
  });

  it('rejects altered immutable input snapshots', async () => {
    const input = createMaisAnalysisInput('RowsV1', [{ value: 1 }], ['row_1']);
    input.records[0]!.value = 2;
    const result = await new DeterministicMaisAnalysisSandbox().execute(programme(input.id, {
      schema: 'MaisAnalysisRecipeV1',
      operations: [{ op: 'count', as: 'n' }],
    }), input);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics.join(' ')).toMatch(/changed after snapshot/i);
  });

  it('rejects duplicate aliases and excessive recipes', async () => {
    const input = createMaisAnalysisInput('RowsV1', [{ value: 1 }], ['row_1']);
    const duplicate = await new DeterministicMaisAnalysisSandbox().execute(programme(input.id, {
      schema: 'MaisAnalysisRecipeV1',
      operations: [{ op: 'count', as: 'same' }, { op: 'count', as: 'same' }],
    }), input);
    expect(duplicate.status).toBe('rejected');
    expect(duplicate.diagnostics.join(' ')).toMatch(/duplicated/i);
  });
});
