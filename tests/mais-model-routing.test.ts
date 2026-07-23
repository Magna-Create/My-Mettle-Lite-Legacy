import { describe, expect, it } from 'vitest';
import { createMaisModelLeaseState, MaisModelLeaseManager, selectMaisModel, type MaisModelRuntimeAdapter } from '../src/mais/modelLeases';

class RecordingRuntime implements MaisModelRuntimeAdapter {
  loads: Array<{ modelId: string; backend: string; contextTokens: number }> = [];
  unloads: string[] = [];

  async load(request: Parameters<MaisModelRuntimeAdapter['load']>[0]): Promise<void> {
    this.loads.push({ modelId: request.model.modelId, backend: request.backend, contextTokens: request.contextTokens });
  }

  async unload(modelId: string): Promise<void> {
    this.unloads.push(modelId);
  }
}

describe('MAIS role routing', () => {
  it('routes frequent light work to Gemma E2B', () => {
    expect(selectMaisModel('governor', 'light').modelId).toBe('google.gemma-4-e2b-it');
    expect(selectMaisModel('coach', 'light').modelId).toBe('google.gemma-4-e2b-it');
  });

  it('routes bounded standard analysis and audit work to Gemma E2B', () => {
    expect(selectMaisModel('analyst', 'standard').modelId).toBe('google.gemma-4-e2b-it');
    expect(selectMaisModel('auditor', 'standard').modelId).toBe('google.gemma-4-e2b-it');
  });

  it('routes coding and deep reasoning to the published Qwen3-4B model', () => {
    expect(selectMaisModel('coding_analyst', 'deep').modelId).toBe('qwen.qwen3-4b');
    expect(selectMaisModel('analyst', 'deep').modelId).toBe('qwen.qwen3-4b');
  });

  it('routes semantic retrieval to EmbeddingGemma', () => {
    expect(selectMaisModel('retrieval', 'light').modelId).toBe('google.embeddinggemma');
  });

  it('uses CPU for ordinary E2B work and the compiled Qwen NPU/context ceiling for deep work', async () => {
    const runtime = new RecordingRuntime();
    const manager = new MaisModelLeaseManager(runtime, createMaisModelLeaseState());
    const e2b = await manager.acquire({ taskId: 'quick', role: 'governor', tier: 'light' });
    expect(e2b.backend).toBe('cpu');
    await manager.release(e2b.id);

    const standard = await manager.acquire({ taskId: 'normal', role: 'analyst', tier: 'standard' });
    expect(standard.modelId).toBe('google.gemma-4-e2b-it');
    expect(standard.backend).toBe('cpu');
    await manager.release(standard.id);

    const qwen = await manager.acquire({ taskId: 'deep', role: 'coding_analyst', tier: 'deep', contextTokens: 16_000 });
    expect(qwen.modelId).toBe('qwen.qwen3-4b');
    expect(qwen.runtime).toBe('geniex-qairt');
    expect(qwen.backend).toBe('npu');
    expect(qwen.contextTokens).toBe(12_288);
    await manager.release(qwen.id);
  });
});
