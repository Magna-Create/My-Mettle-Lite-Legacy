import { describe, expect, it } from 'vitest';
import { createMaisAnalysisInput, DeterministicMaisAnalysisSandbox, type MaisAnalysisProgram } from '../src/mais/analysisSandbox';
import { reduceMaisAnalysisArtifact } from '../src/mais/analysisArtifactReducer';
import type { MaisArtifact } from '../src/mais/contracts';

async function completedArtifact(): Promise<MaisArtifact> {
  const input = createMaisAnalysisInput('RowsV1', [{ value: 1 }, { value: 3 }], ['row_1', 'row_2']);
  const program: MaisAnalysisProgram = {
    id: 'program_1',
    language: 'javascript_subset',
    source: JSON.stringify({ schema: 'MaisAnalysisRecipeV1', operations: [{ op: 'mean', field: 'value', as: 'average' }] }),
    inputSnapshotId: input.id,
    outputSchema: 'ResultV1',
    permittedLibraries: ['statistics'],
    createdByTaskId: 'task_1',
    createdAt: '2026-07-21T15:00:00.000Z',
  };
  const run = await new DeterministicMaisAnalysisSandbox().execute(program, input);
  return {
    id: 'artifact_1',
    taskId: 'task_1',
    episodeId: 'episode_1',
    kind: 'analysis_result',
    createdBy: 'coding_analyst',
    createdAt: '2026-07-21T15:01:00.000Z',
    content: { analysisExecution: { input, program, run } },
    provenanceRefs: ['row_1', 'row_2'],
  };
}

describe('MAIS analysis artefact reducer', () => {
  it('accepts a completed host-validated execution', async () => {
    const reduction = reduceMaisAnalysisArtifact(await completedArtifact());
    expect(reduction.diagnostics).toEqual([]);
    expect(reduction.execution?.run.status).toBe('completed');
    expect(reduction.execution?.run.output.results).toEqual({ average: 2 });
  });

  it('rejects mismatched programme and run references', async () => {
    const artifact = await completedArtifact();
    const execution = artifact.content.analysisExecution as { run: { programId: string } };
    execution.run.programId = 'wrong_program';
    const reduction = reduceMaisAnalysisArtifact(artifact);
    expect(reduction.execution).toBeNull();
    expect(reduction.diagnostics.join(' ')).toMatch(/does not reference/i);
  });

  it('ignores simulator and unrelated artefacts', () => {
    const simulator: MaisArtifact = {
      id: 'simulator', taskId: 'task', episodeId: 'episode', kind: 'analysis_result', createdBy: 'coding_analyst',
      createdAt: '2026-07-21T15:00:00.000Z', content: { simulator: true }, provenanceRefs: [],
    };
    expect(reduceMaisAnalysisArtifact(simulator)).toEqual({ execution: null, diagnostics: [] });
    expect(reduceMaisAnalysisArtifact({ ...simulator, kind: 'plan', createdBy: 'governor', content: {} })).toEqual({ execution: null, diagnostics: [] });
  });
});
