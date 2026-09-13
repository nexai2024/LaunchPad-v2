import { describe, it, expect, vi, beforeEach } from 'vitest';

const FAKE_MODEL = { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o' };

const { subscribeHandlers, MockAgent } = vi.hoisted(() => {
  const subscribeHandlers: Array<(event: any) => void> = [];
  class MockAgent {
    state: { model?: unknown; tools?: unknown[]; systemPrompt?: string; messages?: unknown[] } = {};
    private handler: ((event: any) => void) | null = null;
    subscribe(cb: (event: any) => void) {
      this.handler = cb;
      subscribeHandlers.push(cb);
    }
    async prompt(_text: string) {
      this.handler?.({ type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'web_search', args: { q: 'x' } });
      this.handler?.({ type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'web_search', result: { hits: 1 }, isError: false });
      this.handler?.({
        type: 'message_end',
        message: { role: 'assistant', usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0, totalTokens: 150, cost: { total: 0.002 } } },
      });
    }
    async waitForIdle() {}
    abort() {}
  }
  return { subscribeHandlers, MockAgent };
});

vi.mock('@earendil-works/pi-agent-core', () => ({ Agent: MockAgent }));
vi.mock('@earendil-works/pi-ai', () => ({
  streamSimple: vi.fn(),
  getModel: vi.fn(() => FAKE_MODEL),
  getEnvApiKey: vi.fn(() => 'test-key'),
}));
vi.mock('@/lib/pi-tools', () => ({ getTools: vi.fn(() => []) }));
vi.mock('@/lib/llm/router', () => ({ pickModel: vi.fn(() => ({ provider: 'openai', model: 'gpt-4o' })) }));

const {
  getLangfuseMock, estimateCostMock, mapToLangfuseModelIdMock, toLangfuseUsageAndCostMock,
  traceMock, spanMock, spanEndMock, generationMock, traceUpdateMock, flushAsyncMock,
} = vi.hoisted(() => {
  const spanEndMock = vi.fn();
  const spanMock = vi.fn(() => ({ end: spanEndMock }));
  const generationMock = vi.fn();
  const traceUpdateMock = vi.fn();
  const traceMock = vi.fn(() => ({ id: 'trace_abc', span: spanMock, generation: generationMock, update: traceUpdateMock }));
  const flushAsyncMock = vi.fn().mockResolvedValue(undefined);
  const getLangfuseMock = vi.fn();
  const estimateCostMock = vi.fn(() => 0.001);
  const mapToLangfuseModelIdMock = vi.fn((m: string) => m);
  const toLangfuseUsageAndCostMock = vi.fn((usage: any, cost: number) => ({
    usageDetails: { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, total: (usage.input_tokens || 0) + (usage.output_tokens || 0) },
    costDetails: cost > 0 ? { total: cost } : undefined,
  }));
  return {
    getLangfuseMock, estimateCostMock, mapToLangfuseModelIdMock, toLangfuseUsageAndCostMock,
    traceMock, spanMock, spanEndMock, generationMock, traceUpdateMock, flushAsyncMock,
  };
});

vi.mock('@/lib/telemetry', () => ({
  getLangfuse: getLangfuseMock,
  estimateCost: estimateCostMock,
  mapToLangfuseModelId: mapToLangfuseModelIdMock,
  toLangfuseUsageAndCost: toLangfuseUsageAndCostMock,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  appendFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
  rmSync: vi.fn(),
}));

import { runAgent } from '@/lib/pi-agent';

describe('runAgent — live Langfuse tracing', () => {
  beforeEach(() => {
    subscribeHandlers.length = 0;
    traceMock.mockClear();
    spanMock.mockClear();
    spanEndMock.mockClear();
    generationMock.mockClear();
    traceUpdateMock.mockClear();
    flushAsyncMock.mockClear();
    getLangfuseMock.mockReset();
  });

  it('tracing OFF: no trace/span/generation calls, result shape unaffected', async () => {
    getLangfuseMock.mockReturnValue(null);

    const result = await runAgent('hello');

    expect(traceMock).not.toHaveBeenCalled();
    expect(spanMock).not.toHaveBeenCalled();
    expect(generationMock).not.toHaveBeenCalled();
    expect(flushAsyncMock).not.toHaveBeenCalled();

    expect(result.text).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.usage).toMatchObject({ input: 100, output: 50 });
    expect(result.langfuseTraceId).toBeFalsy();
  });

  it('tracing ON: one trace, one span per tool call, one generation per sub-call usage, flush exactly once', async () => {
    getLangfuseMock.mockReturnValue({ trace: traceMock, flushAsync: flushAsyncMock });

    const result = await runAgent('hello', { projectId: 'proj_1', step: 'chat', userId: 'user_1', traceName: 'chat-turn' });

    expect(traceMock).toHaveBeenCalledTimes(1);
    expect(traceMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'chat-turn',
      userId: 'user_1',
      input: 'hello',
    }));

    expect(spanMock).toHaveBeenCalledTimes(1);
    expect(spanMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'web_search' }));
    expect(spanEndMock).toHaveBeenCalledTimes(1);
    expect(spanEndMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'DEFAULT' }));

    expect(generationMock).toHaveBeenCalledTimes(1);
    expect(generationMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'openai generation' }));

    expect(traceUpdateMock).toHaveBeenCalledTimes(1);
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);

    expect(result.langfuseTraceId).toBe('trace_abc');
    expect(result.usage).toMatchObject({ input: 100, output: 50 });
  });

  it('a tool span open/close or generation failure never breaks the run (non-fatal, matches try/catch contract elsewhere in this file)', async () => {
    getLangfuseMock.mockReturnValue({ trace: traceMock, flushAsync: flushAsyncMock });
    spanMock.mockImplementationOnce(() => { throw new Error('span boom'); });

    const result = await runAgent('hello', { projectId: 'proj_1' });

    expect(result.text).toBe('');
    expect(result.usage).toMatchObject({ input: 100, output: 50 });
  });
});
