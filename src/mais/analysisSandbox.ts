import { createId } from '../domain/ids';

export interface MaisAnalysisInputSnapshot {
  id: string;
  createdAt: string;
  schema: string;
  records: Record<string, unknown>[];
  provenanceRefs: string[];
  immutableFingerprint: string;
}

export interface MaisAnalysisProgram {
  id: string;
  language: 'python_subset' | 'javascript_subset';
  source: string;
  inputSnapshotId: string;
  outputSchema: string;
  permittedLibraries: string[];
  createdByTaskId: string;
  createdAt: string;
}

export interface MaisAnalysisRun {
  id: string;
  programId: string;
  inputSnapshotId: string;
  status: 'validated' | 'completed' | 'rejected' | 'failed';
  startedAt: string;
  completedAt?: string | undefined;
  output: Record<string, unknown>;
  diagnostics: string[];
  executionMs: number;
}

export interface MaisAnalysisSandbox {
  execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun>;
}

const PROHIBITED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(fetch|XMLHttpRequest|WebSocket)\b/, 'network access'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'direct persistence access'],
  [/\b(require|process|Deno)\b/, 'host runtime access'],
  [/\b(eval|Function)\s*\(/, 'dynamic code execution'],
  [/\b(java|android|navigator)\b/i, 'device or Android API access'],
  [/\b(fs|path|os|subprocess|socket|requests)\b/, 'filesystem, process or network libraries'],
];

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`).join(',')}}`;
}

function fingerprint(value: unknown): string {
  const input = canonicalise(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `analysis-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createMaisAnalysisInput(
  schema: string,
  records: Record<string, unknown>[],
  provenanceRefs: string[],
  now = new Date().toISOString(),
): MaisAnalysisInputSnapshot {
  const immutable = { schema, records, provenanceRefs };
  return {
    id: createId('mais_analysis_input'),
    createdAt: now,
    schema,
    records: structuredClone(records),
    provenanceRefs: [...provenanceRefs],
    immutableFingerprint: fingerprint(immutable),
  };
}

export function validateMaisAnalysisProgram(program: MaisAnalysisProgram): string[] {
  const errors: string[] = [];
  if (!program.source.trim()) errors.push('Analysis programme is empty.');
  if (!program.outputSchema.trim()) errors.push('Analysis programme requires an output schema.');
  if (program.source.length > 30_000) errors.push('Analysis programme exceeds the Phase 3A source limit.');
  for (const [pattern, label] of PROHIBITED_PATTERNS) {
    if (pattern.test(program.source)) errors.push(`Analysis programme requests prohibited ${label}.`);
  }
  const allowed = program.language === 'python_subset'
    ? new Set(['math', 'statistics', 'numpy', 'pandas'])
    : new Set(['math', 'statistics']);
  for (const library of program.permittedLibraries) {
    if (!allowed.has(library)) errors.push(`Library ${library} is not approved for ${program.language}.`);
  }
  return errors;
}

export class SimulatedMaisAnalysisSandbox implements MaisAnalysisSandbox {
  async execute(program: MaisAnalysisProgram, input: MaisAnalysisInputSnapshot): Promise<MaisAnalysisRun> {
    const startedAt = new Date().toISOString();
    const errors = validateMaisAnalysisProgram(program);
    const currentFingerprint = fingerprint({ schema: input.schema, records: input.records, provenanceRefs: input.provenanceRefs });
    if (currentFingerprint !== input.immutableFingerprint) errors.push('Analysis input changed after snapshot creation.');
    if (program.inputSnapshotId !== input.id) errors.push('Programme input snapshot does not match supplied evidence.');

    if (errors.length > 0) {
      return {
        id: createId('mais_analysis_run'),
        programId: program.id,
        inputSnapshotId: input.id,
        status: 'rejected',
        startedAt,
        completedAt: new Date().toISOString(),
        output: {},
        diagnostics: errors,
        executionMs: 0,
      };
    }

    return {
      id: createId('mais_analysis_run'),
      programId: program.id,
      inputSnapshotId: input.id,
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      output: {
        simulator: true,
        outputSchema: program.outputSchema,
        recordCount: input.records.length,
        provenanceRefs: input.provenanceRefs,
        programmeFingerprint: fingerprint(program.source),
      },
      diagnostics: ['Phase 3A simulator validated the programme without executing model-generated code.'],
      executionMs: 0,
    };
  }
}
