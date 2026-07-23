import { describe, expect, it } from 'vitest';
import {
  canDirectlyDownloadMaisArtifact,
  formatModelBytes,
  getEmbeddingGemmaTokenizerArtifact,
  getFirstMaisRuntimeArtifact,
  getMaisGenerativeArtifacts,
  getMaisModelArtifact,
  getMaisModelArtifactFiles,
  getMaisModelArtifacts,
} from '../src/mais/modelArtifacts';

describe('MAIS model artefact registry', () => {
  it('retains the pinned generic Gemma 4 E2B artefact as the first runtime candidate', () => {
    const artifact = getFirstMaisRuntimeArtifact();
    expect(artifact.artifactId).toBe('google.gemma-4-e2b-it.litertlm.default');
    expect(artifact.modelId).toBe('google.gemma-4-e2b-it');
    expect(artifact.defaultBackend).toBe('cpu');
    expect(artifact.sha256).toBe('ab7838cdfc8f77e54d8ca45eadceb20452d9f01e4bfade03e5dce27911b27e42');
    expect(artifact.approximateBytes).toBeGreaterThan(2_000_000_000);
  });

  it('registers generic and Qualcomm E2B builds as two artefacts of one logical model', () => {
    const generic = getMaisModelArtifact('google.gemma-4-e2b-it.litertlm.default');
    const qualcomm = getMaisModelArtifact('google.gemma-4-e2b-it.litertlm.qualcomm-sm8750');
    expect(generic).toMatchObject({ modelId: 'google.gemma-4-e2b-it', backendCandidates: ['cpu', 'gpu'], defaultBackend: 'cpu' });
    expect(qualcomm).toMatchObject({
      modelId: 'google.gemma-4-e2b-it',
      backendCandidates: ['npu'],
      defaultBackend: 'npu',
      approximateBytes: 3_016_294_400,
      sha256: '41dd675fbe735b6029012b5576a5716bac614fd8156de0128db4c9dff3cebd4e',
    });
  });

  it('replaces E4B and the Qwen3-8B stand-in with the published 12K Qwen3-4B pack', () => {
    const generative = getMaisGenerativeArtifacts();
    expect(generative.map((artifact) => artifact.artifactId)).toEqual([
      'google.gemma-4-e2b-it.litertlm.default',
      'google.gemma-4-e2b-it.litertlm.qualcomm-sm8750',
      'qwen.qwen3-4b.geniex-qairt.w4a16.sm8750.ctx12288',
    ]);
    expect(generative.some((artifact) => artifact.modelId === 'google.gemma-4-e4b-it')).toBe(false);
    expect(generative.some((artifact) => artifact.modelId === 'qwen.qwen3-8b')).toBe(false);
  });

  it('describes Qwen as a resumable direct-download GenieX bundle', () => {
    const qwen = getMaisModelArtifact('qwen.qwen3-4b.geniex-qairt.w4a16.sm8750.ctx12288');
    const files = getMaisModelArtifactFiles(qwen);
    expect(qwen).toMatchObject({
      modelId: 'qwen.qwen3-4b',
      runtime: 'geniex-qairt',
      defaultBackend: 'npu',
      contextTokens: 12_288,
      integrityMode: 'trust_on_first_use',
    });
    expect(files).toHaveLength(15);
    expect(files.map((file) => file.fileName)).toEqual(expect.arrayContaining([
      'genie_config.json',
      'part1_of_4.bin',
      'part2_of_4.bin',
      'part3_of_4.bin',
      'part4_of_4.bin',
      'tokenizer.json',
    ]));
    expect(canDirectlyDownloadMaisArtifact(qwen)).toBe(true);
  });

  it('keeps both EmbeddingGemma files as gated imports', () => {
    const embedding = getMaisModelArtifact('google.embeddinggemma-300m.qualcomm-sm8750.seq512');
    const tokenizer = getEmbeddingGemmaTokenizerArtifact();
    expect(embedding).toMatchObject({ defaultBackend: 'npu', downloadPolicy: 'manual', format: '.tflite' });
    expect(tokenizer).toMatchObject({ fileName: 'sentencepiece.model', downloadPolicy: 'manual', format: '.model' });
    expect(canDirectlyDownloadMaisArtifact(embedding)).toBe(false);
    expect(canDirectlyDownloadMaisArtifact(tokenizer)).toBe(false);
  });

  it('returns cloned definitions so UI changes cannot mutate the registry', () => {
    const first = getMaisModelArtifacts();
    first[0]!.displayName = 'mutated';
    expect(getMaisModelArtifacts()[0]?.displayName).toBe('Gemma 4 E2B IT · CPU/GPU');
  });

  it('formats model storage quantities for the runtime panel', () => {
    expect(formatModelBytes(0)).toBe('0 MB');
    expect(formatModelBytes(512 * 1024 * 1024)).toBe('512 MB');
    expect(formatModelBytes(2.5 * 1024 ** 3)).toBe('2.50 GB');
  });
});
