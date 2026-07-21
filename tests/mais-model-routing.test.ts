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

  it('routes normal analysis and audit work to Gemma E4B', () => {
    expect(selectMaisModel('analyst', 'standard').modelId).toBe('google.gemma-4-e4b-it');
    expect(selectMaisModel('auditor', 'standard').modelId).toBe('google.gemma-4-e4b-it');
  });

  it('routes coding and deep reasoning to Qwen3-8B', () => {
    expect(selectMaisModel('coding_analyst', 'deep').modelId).toBe('qwen.qwen3-8b');
    expect(selectMaisModel('analyst', 'deep').modelId).toBe('qwen.qwen3-8b');
  });

  it('routes semantic retrieval to EmbeddingGemma', () => {
    expect(selectMaisModel('retrieval', 'light').modelId).toBe('google.embeddinggemma');
  });

  it('uses backend order and context ceiling from the selected model registry', async () => {
    const runtime = new RecordingRuntime();
    const manager = new MaisModelLeaseManager(runtime, createMaisModelLeaseState());
    const e2b = await manager.acquire({ taskId: 'quick', role: 'governor', tier: 'light' });
    expect(e2b.backend).toBe('cpu');
    await manager.release(e2b.id);

    const e4b = await manager.acquire({ taskId: 'normal', role: 'analyst', tier: 'standard' });
    expect(e4b.backend).toBe('gpu');
    await manager.release(e4b.id);

    const qwen = await manager.acquire({ taskId: 'deep', role: 'coding_analyst', tier: 'deep', contextTokens: 8192 });
    expect(qwen.backend).toBe('gpu');
    expect(qwen.contextTokens).toBe(2048);
    await manager.release(qwen.id);
  });
});
