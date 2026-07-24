export const MAIS_RESTRICTED_PYTHON_CONTRACT_VERSION = 1;

export const MAIS_RESTRICTED_PYTHON_ALLOWED_MODULES = [
  'math',
  'statistics',
  'numpy',
  'pandas',
  'scipy.stats',
  'scipy.signal',
] as const;

export interface MaisRestrictedPythonTestCase {
  name: string;
  inputRecords: Record<string, unknown>[];
  expected: Record<string, unknown>;
  tolerance?: number;
}

export interface MaisRestrictedPythonProgrammeV1 {
  schema: 'MaisRestrictedPythonProgrammeV1';
  contractVersion: typeof MAIS_RESTRICTED_PYTHON_CONTRACT_VERSION;
  question: string;
  reasonDeterministicToolsAreInsufficient: string;
  inputSnapshotId: string;
  expectedInputFields: string[];
  expectedOutputFields: string[];
  assumptions: string[];
  missingDataPolicy: string;
  minimumRecordCount: number;
  permittedModules: string[];
  source: string;
  tests: MaisRestrictedPythonTestCase[];
  randomSeed: number;
  limits: {
    cpuMs: number;
    memoryMb: number;
    outputBytes: number;
  };
}

export interface MaisRestrictedPythonValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const PROHIBITED = [
  [/\b(importlib|__import__|compile|eval|exec|globals|locals)\b/, 'dynamic code loading'],
  [/\b(open|pathlib|os|sys|subprocess|shutil|tempfile)\b/, 'filesystem or process access'],
  [/\b(socket|requests|urllib|httpx|aiohttp|websocket)\b/, 'network access'],
  [/\b(ctypes|cffi|marshal|pickle|shelve)\b/, 'native or unsafe serialisation access'],
  [/\b(threading|multiprocessing|asyncio|concurrent)\b/, 'unbounded concurrency'],
  [/\b(android|java|jnius|capacitor)\b/i, 'Android or host access'],
] as const;

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function validateMaisRestrictedPythonProgramme(
  programme: MaisRestrictedPythonProgrammeV1,
  inputSnapshotId: string,
): MaisRestrictedPythonValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (programme.schema !== 'MaisRestrictedPythonProgrammeV1' || programme.contractVersion !== MAIS_RESTRICTED_PYTHON_CONTRACT_VERSION) {
    errors.push('Unsupported restricted Python programme schema.');
  }
  if (programme.inputSnapshotId !== inputSnapshotId) errors.push('Python programme references a different immutable input snapshot.');
  if (!nonEmpty(programme.question)) errors.push('An analytical question is required.');
  if (!nonEmpty(programme.reasonDeterministicToolsAreInsufficient)) errors.push('The deterministic capability gap must be stated.');
  if (!nonEmpty(programme.source)) errors.push('Python source is empty.');
  if (programme.source.length > 40_000) errors.push('Python source exceeds the 40,000-character limit.');
  if (programme.minimumRecordCount < 1 || programme.minimumRecordCount > 5_000) errors.push('Minimum record count is outside the supported range.');
  if (!Number.isInteger(programme.randomSeed)) errors.push('A deterministic integer random seed is required.');
  if (programme.tests.length < 2) errors.push('At least two synthetic tests are required.');
  if (programme.expectedInputFields.length === 0 || programme.expectedOutputFields.length === 0) errors.push('Input and output field contracts are required.');
  if (!nonEmpty(programme.missingDataPolicy)) errors.push('A missing-data policy is required.');

  const allowed = new Set<string>(MAIS_RESTRICTED_PYTHON_ALLOWED_MODULES);
  for (const module of programme.permittedModules) if (!allowed.has(module)) errors.push(`Python module ${module} is not approved.`);
  for (const [pattern, label] of PROHIBITED) if (pattern.test(programme.source)) errors.push(`Python source requests prohibited ${label}.`);

  if (programme.limits.cpuMs < 50 || programme.limits.cpuMs > 10_000) errors.push('CPU limit must be between 50 and 10,000 ms.');
  if (programme.limits.memoryMb < 16 || programme.limits.memoryMb > 512) errors.push('Memory limit must be between 16 and 512 MB.');
  if (programme.limits.outputBytes < 1_024 || programme.limits.outputBytes > 1_000_000) errors.push('Output limit must be between 1 KB and 1 MB.');
  if (programme.permittedModules.includes('pandas') && programme.limits.memoryMb < 128) warnings.push('Pandas may exceed the requested memory limit on Android.');
  if (!programme.tests.some((test) => test.inputRecords.length === 0 || test.inputRecords.some((row) => Object.values(row).some((value) => value === null)))) {
    warnings.push('No empty or missing-data test case is declared.');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export interface MaisRestrictedPythonRuntimeStatus {
  available: false;
  reason: string;
  contractVersion: number;
  allowedModules: readonly string[];
}

export function restrictedPythonRuntimeStatus(): MaisRestrictedPythonRuntimeStatus {
  return {
    available: false,
    reason: 'The Android restricted Python runtime is intentionally not enabled. Programmes may be proposed and reviewed, but execution requires a separately validated sandbox implementation.',
    contractVersion: MAIS_RESTRICTED_PYTHON_CONTRACT_VERSION,
    allowedModules: MAIS_RESTRICTED_PYTHON_ALLOWED_MODULES,
  };
}
