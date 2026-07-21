import type { MaisAnalysisInputSnapshot, MaisAnalysisProgram, MaisAnalysisRun } from './analysisSandbox';
import type { MaisArtifact } from './contracts';

export interface MaisReducedAnalysisExecution {
  input: MaisAnalysisInputSnapshot;
  program: MaisAnalysisProgram;
  run: MaisAnalysisRun;
}

export interface MaisAnalysisArtifactReduction {
  execution: MaisReducedAnalysisExecution | null;
  diagnostics: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validInput(value: unknown): value is MaisAnalysisInputSnapshot {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.schema === 'string'
    && Array.isArray(value.records)
    && value.records.every(isRecord)
    && stringArray(value.provenanceRefs)
    && typeof value.immutableFingerprint === 'string';
}

function validProgram(value: unknown): value is MaisAnalysisProgram {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.language === 'javascript_subset' || value.language === 'python_subset')
    && typeof value.source === 'string'
    && typeof value.inputSnapshotId === 'string'
    && typeof value.outputSchema === 'string'
    && stringArray(value.permittedLibraries)
    && typeof value.createdByTaskId === 'string'
    && typeof value.createdAt === 'string';
}

function validRun(value: unknown): value is MaisAnalysisRun {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.programId === 'string'
    && typeof value.inputSnapshotId === 'string'
    && ['validated', 'completed', 'rejected', 'failed'].includes(String(value.status))
    && typeof value.startedAt === 'string'
    && isRecord(value.output)
    && stringArray(value.diagnostics)
    && typeof value.executionMs === 'number';
}

export function reduceMaisAnalysisArtifact(artifact: MaisArtifact): MaisAnalysisArtifactReduction {
  if (artifact.kind !== 'analysis_result') return { execution: null, diagnostics: [] };
  if (artifact.content.simulator === true) return { execution: null, diagnostics: [] };
  const value = artifact.content.analysisExecution;
  if (!isRecord(value)) return { execution: null, diagnostics: ['Analysis result contained no host-validated execution.'] };
  if (!validInput(value.input)) return { execution: null, diagnostics: ['Analysis execution contained an invalid immutable input snapshot.'] };
  if (!validProgram(value.program)) return { execution: null, diagnostics: ['Analysis execution contained an invalid generated programme.'] };
  if (!validRun(value.run)) return { execution: null, diagnostics: ['Analysis execution contained an invalid run record.'] };
  if (value.program.inputSnapshotId !== value.input.id || value.run.inputSnapshotId !== value.input.id) {
    return { execution: null, diagnostics: ['Analysis execution snapshot IDs do not match.'] };
  }
  if (value.run.programId !== value.program.id) {
    return { execution: null, diagnostics: ['Analysis run does not reference its generated programme.'] };
  }
  if (value.run.status !== 'completed') {
    return { execution: null, diagnostics: [`Analysis run was ${value.run.status} rather than completed.`] };
  }
  return {
    execution: {
      input: structuredClone(value.input),
      program: structuredClone(value.program),
      run: structuredClone(value.run),
    },
    diagnostics: [],
  };
}
