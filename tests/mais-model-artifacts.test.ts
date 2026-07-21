import { describe, expect, it } from 'vitest';
import {
  canDirectlyDownloadMaisArtifact,
  formatModelBytes,
  getEmbeddingGemmaTokenizerArtifact,
  getFirstMaisRuntimeArtifact,
  getMaisGenerativeArtifacts,
  getMaisModelArtifact,
  getMaisModelArtifacts,
} from '../src/mais/modelArtifacts';

describe('MAIS model artefact registry', () => {
  it('retains the verified Gemma 4 E2B artefact as the first runtime candidate', () => {
    const artifact = getFirstMaisRuntimeArtifact();
    expect(artifact.modelId).toBe('google.gemma-4-e2b-it');
    expect(artifact.defaultBackend).toBe('cpu');
    expect(artifact.sha256).toBe('181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c');
    expect(artifact.approximateBytes).toBeGreaterThan(2_000_000_000);
  });

  it('retains benchmark and temporary deep artefacts separately from production routing', () => {
    const generative = getMaisGenerativeArtifacts();
    expect(generative.map((artifact) => artifact.modelId)).toEqual([
      'google.gemma-4-e2b-it',
      'google.gemma-4-e4b-it',
      'qwen.qwen3-8b',
    ]);
    expect(getMaisModelArtifact('google.gemma-4-e4b-it.litertlm.default').status).toBe('benchmark_only');
    expect(getMaisModelArtifact('qwen.qwen3-8b.litertlm.mixed-int4')).toMatchObject({ defaultBackend: 'cpu', contextTokens: 2048 });
  });

  it('marks Qwen as trust-on-first-use and both EmbeddingGemma files as gated imports', () => {
    const qwen = getMaisModelArtifact('qwen.qwen3-8b.litertlm.mixed-int4');
    const embedding = getMaisModelArtifact('google.embeddinggemma-300m.qualcomm-sm8750.seq512');
    const tokenizer = getEmbeddingGemmaTokenizerArtifact();
    expect(qwen.integrityMode).toBe('trust_on_first_use');
    expect(canDirectlyDownloadMaisArtifact(qwen)).toBe(true);
    expect(embedding).toMatchObject({ defaultBackend: 'npu', downloadPolicy: 'manual', format: '.tflite' });
    expect(tokenizer).toMatchObject({ fileName: 'sentencepiece.model', downloadPolicy: 'manual', format: '.model' });
    expect(canDirectlyDownloadMaisArtifact(embedding)).toBe(false);
    expect(canDirectlyDownloadMaisArtifact(tokenizer)).toBe(false);
  });

  it('returns cloned definitions so UI changes cannot mutate the registry', () => {
    const first = getMaisModelArtifacts();
    first[0]!.displayName = 'mutated';
    expect(getMaisModelArtifacts()[0]?.displayName).toBe('Gemma 4 E2B IT');
  });

  it('formats model storage quantities for the runtime panel', () => {
    expect(formatModelBytes(0)).toBe('0 MB');
    expect(formatModelBytes(512 * 1024 * 1024)).toBe('512 MB');
    expect(formatModelBytes(2.5 * 1024 ** 3)).toBe('2.50 GB');
  });
});
