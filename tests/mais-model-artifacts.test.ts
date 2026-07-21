import { describe, expect, it } from 'vitest';
import { formatModelBytes, getFirstMaisRuntimeArtifact, getMaisModelArtifacts } from '../src/mais/modelArtifacts';

describe('MAIS model artefact registry', () => {
  it('registers the official Gemma 4 E2B LiteRT-LM artefact without embedding model bytes', () => {
    const artifact = getFirstMaisRuntimeArtifact();
    expect(artifact.modelId).toBe('google.gemma-4-e2b-it');
    expect(artifact.runtime).toBe('litert-lm');
    expect(artifact.fileName).toBe('gemma-4-E2B-it.litertlm');
    expect(artifact.sha256).toBe('181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c');
    expect(artifact.downloadUrl).toMatch(/^https:\/\//);
    expect(artifact.approximateBytes).toBeGreaterThan(2_000_000_000);
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
