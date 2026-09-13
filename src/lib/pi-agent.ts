import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel, getEnvApiKey } from '@earendil-works/pi-ai/compat';
import type { Message, Usage } from '@earendil-works/pi-ai/compat';
import { MODEL_CONFIG } from './llm/models';
import { join } from 'path';
import { mkdirSync, readFileSync, appendFileSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { getTools } from './pi-tools';
import { pickModel, type TaskLabel } from './llm/router';
import { getLangfuse, estimateCost, mapToLangfuseModelId, toLangfuseUsageAndCost, type TokenUsage } from './telemetry';
import type { LangfuseTraceClient, LangfuseSpanClient } from 'langfuse';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL_ID = process.env.PI_MODEL || MODEL_CONFIG['gpt-4o'].id;
const SESSIONS_DIR = process.env.LAUNCHPAD_SESSIONS_DIR || join(process.env.HOME || '/tmp', '.launchpad', 'sessions');

let _sessionsCleaned = false;
const STALE_SESSION_DAYS = 30;

function cleanStaleSessions() {
  if (_sessionsCleaned) return;
  _sessionsCleaned = true;
  try {
    if (!existsSync(SESSIONS_DIR)) return;
    const threshold = Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000;
    const dirs = readdirSync(SESSIONS_DIR);
    for (const dir of dirs) {
      const sessionFile = join(SESSIONS_DIR, dir, 'session.jsonl');
      try {
        if (!existsSync(sessionFile)) continue;
        const stat = statSync(sessionFile);
        if (stat.mtimeMs < threshold) {
          rmSync(join(SESSIONS_DIR, dir), { recursive: true, force: true });
        }
      } catch {
        // Skip individual dirs that fail
      }
    }
  } catch (err) {
    console.warn('[pi-agent] stale session cleanup failed (non-fatal):', err);
  }
}

function resolveModel(task?: TaskLabel, override?: { provider: string; model: string } | null) {
  const target = override
    ?? (task
      ? pickModel(task)
      : { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL_ID });
  const model = getModel(target.provider as any, target.model as any);
  if (!model) {
    throw new Error(`[pi-agent] unknown model ${target.provider}:${target.model} — not in pi-ai's catalog; check MODEL_CONFIG`);
  }
  return model;
}

const lpStreamFn: typeof streamSimple = (model, context, options) =>
  streamSimple(model, context, { ...options, maxRetries: 2 });

function makeGetApiKey(userKey?: { provider: string; apiKey: string }) {
  return (provider: string) =>
    userKey && userKey.provider === provider ? userKey.apiKey : getEnvApiKey(provider as any);
}

interface SessionEntry {
  role: string;
  content: unknown;
  timestamp: number;
  usage?: unknown;
}

function sessionPath(sessionId: string): string {
  const dir = join(SESSIONS_DIR, sessionId);
  mkdirSync(dir, { recursive: true });
  return join(dir, 'session.jsonl');
}

function dropUnpairedToolExchanges(messages: AgentMessage[]): AgentMessage[] {
  const out: AgentMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i] as { role?: string; content?: unknown };
    if (msg.role === 'toolResult') {
      i++;
      continue;
    }
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      out.push(messages[i]); i++;
      continue;
    }
    const callIds = new Set(
      (msg.content as Array<{ type?: string; id?: string }>)
        .filter((b) => b?.type === 'toolCall' && typeof b.id === 'string')
        .map((b) => b.id as string),
    );
    if (callIds.size === 0) {
      out.push(messages[i]); i++;
      continue;
    }
    const results: AgentMessage[] = [];
    let j = i + 1;
    const answered = new Set<string>();
    while (j < messages.length && (messages[j] as { role?: string }).role === 'toolResult') {
      const id = (messages[j] as { toolCallId?: string }).toolCallId;
      if (typeof id === 'string' && callIds.has(id)) answered.add(id);
      results.push(messages[j]);
      j++;
    }
    if (answered.size === callIds.size) {
      out.push(messages[i], ...results);
    }
    i = j;
  }
  return out;
}

export function trimSessionMessages(messages: AgentMessage[], maxMessages?: number): AgentMessage[] {
  messages = dropUnpairedToolExchanges(messages);
  while (messages.length > 0) {
    const last = messages[messages.length - 1] as { role?: string; content?: unknown };
    if (last.role !== 'assistant') break;

    const content = last.content;
    const isEmpty =
      content === undefined ||
      content === null ||
      (Array.isArray(content) && content.length === 0) ||
      (typeof content === 'string' && content.trim() === '');
    const contentStr = JSON.stringify(content ?? '');
    const hasUnpairedToolCall = contentStr.includes('toolCall') || contentStr.includes('tool_use');

    if (!isEmpty && !hasUnpairedToolCall) break;

    messages.pop();
    if (messages.length > 0 && (messages[messages.length - 1] as { role?: string }).role === 'user') {
      messages.pop();
    }
  }

  while (messages.length > 0) {
    const last = messages[messages.length - 1] as { role?: string };
    if (last.role !== 'user') break;
    messages.pop();
  }

  if (maxMessages && maxMessages > 0 && messages.length > maxMessages) {
    messages.splice(0, messages.length - maxMessages);
  }

  while (messages.length > 0 && (messages[0] as { role?: string }).role === 'toolResult') {
    messages.shift();
  }

  return messages;
}

function loadSession(sessionId: string, maxMessages?: number): AgentMessage[] {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return [];

  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    const messages: AgentMessage[] = [];
    for (const line of lines) {
      const entry: SessionEntry = JSON.parse(line);
      if (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'toolResult') {
        messages.push(entry as unknown as AgentMessage);
      }
    }
    return trimSessionMessages(messages, maxMessages);
  } catch {
    return [];
  }
}

function appendToSession(sessionId: string, message: AgentMessage) {
  const path = sessionPath(sessionId);
  appendFileSync(path, JSON.stringify(message) + '\n');
}

function resolveHistory(options: RunAgentOptions): AgentMessage[] {
  const cap = options.maxHistoryMessages ?? 12;
  const fromFile = options.sessionId ? loadSession(options.sessionId, cap) : [];
  const seed = options.seedHistory ?? [];
  const windowedSeed = cap > 0 && seed.length > cap ? seed.slice(seed.length - cap) : seed;
  return windowedSeed.length > fromFile.length ? windowedSeed : fromFile;
}

export interface RunAgentOptions {
  sessionId?: string;
  systemPrompt?: string;
  timeout?: number;
  tools?: boolean;
  extraTools?: AgentTool[];
  projectId?: string;
  step?: string;
  task?: TaskLabel;
  maxToolCalls?: number;
  modelOverride?: { provider: 'openai'; model: string } | null;
  maxTokens?: number;
  maxHistoryMessages?: number;
  seedHistory?: AgentMessage[];
  onDelta?: (delta: string) => void;
  userKey?: { provider: string; apiKey: string };
  userId?: string;
  traceName?: string;
}

export function buildSeedHistory(
  transcript: Array<{ role?: string; content?: unknown }>,
): AgentMessage[] {
  const out: AgentMessage[] = [];
  for (const m of transcript) {
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : null;
    if (!role) continue;
    const text = typeof m.content === 'string' ? m.content.trim() : '';
    if (!text) continue;
    out.push({ role, content: [{ type: 'text', text }] } as unknown as AgentMessage);
  }
  return out;
}

function accumulateUsage(acc: Usage | undefined, incoming: unknown): Usage | undefined {
  if (!incoming || typeof incoming !== 'object') return acc;
  const u = incoming as Record<string, unknown>;
  if (!acc) {
    const clone: Record<string, unknown> = {};
    for (const k of Object.keys(u)) {
      if (k === 'cost' && u.cost && typeof u.cost === 'object') {
        clone.cost = { ...(u.cost as Record<string, unknown>) };
      } else {
        clone[k] = u[k];
      }
    }
    return clone as unknown as Usage;
  }
  const a = acc as unknown as Record<string, unknown>;
  for (const k of ['input', 'inputTokens', 'input_tokens',
    'output', 'outputTokens', 'output_tokens',
    'cacheWrite', 'cacheCreation', 'cache_creation_tokens', 'cacheCreationInputTokens',
    'cacheRead', 'cache_read_tokens', 'cacheReadInputTokens',
    'totalTokens']) {
    const v = u[k];
    if (typeof v === 'number') a[k] = (typeof a[k] === 'number' ? (a[k] as number) : 0) + v;
  }
  if (u.cost && typeof u.cost === 'object') {
    const incomingCost = u.cost as Record<string, unknown>;
    const accCost = (a.cost as Record<string, unknown>) || (a.cost = {});
    for (const k of Object.keys(incomingCost)) {
      const v = incomingCost[k];
      if (typeof v === 'number') {
        accCost[k] = (typeof accCost[k] === 'number' ? (accCost[k] as number) : 0) + v;
      }
    }
  }
  return acc;
}

function toTokenUsage(u: unknown): TokenUsage {
  if (!u || typeof u !== 'object') return {};
  const r = u as Record<string, unknown>;
  const num = (...keys: string[]): number => {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === 'number') return v;
    }
    return 0;
  };
  return {
    input_tokens: num('input', 'inputTokens', 'input_tokens'),
    output_tokens: num('output', 'outputTokens', 'output_tokens'),
    cache_creation_input_tokens: num('cacheWrite', 'cacheCreation', 'cache_creation_tokens', 'cacheCreationInputTokens'),
    cache_read_input_tokens: num('cacheRead', 'cache_read_tokens', 'cacheReadInputTokens'),
  };
}

function resolveGenerationCost(
  usage: TokenUsage,
  authoritative: number | undefined,
  provider: string,
  model: string,
): number {
  return typeof authoritative === 'number' && authoritative > 0
    ? authoritative
    : estimateCost(provider, model, usage);
}

function openAgentTrace(options: RunAgentOptions, prompt: string): LangfuseTraceClient | null {
  const lf = getLangfuse();
  if (!lf) return null;
  try {
    const tags = [options.step, options.task].filter(
      (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
    );
    return lf.trace({
      name: options.traceName || 'agent-run',
      userId: options.userId,
      sessionId: options.sessionId,
      input: prompt.slice(0, 2000),
      metadata: { projectId: options.projectId, step: options.step, task: options.task },
      tags: tags.length > 0 ? tags : undefined,
    });
  } catch (err) {
    console.warn('[pi-agent] Langfuse trace open failed (non-fatal):', (err as Error).message);
    return null;
  }
}

function recordGeneration(
  trace: LangfuseTraceClient | null,
  provider: string,
  modelId: string,
  incomingUsage: unknown,
  startTimeMs?: number,
): void {
  if (!trace || !incomingUsage) return;
  try {
    const tu = toTokenUsage(incomingUsage);
    const authoritative = (incomingUsage as { cost?: { total?: number } })?.cost?.total;
    const cost = resolveGenerationCost(tu, authoritative, provider, modelId);
    const { usageDetails, costDetails } = toLangfuseUsageAndCost(tu, cost);
    trace.generation({
      name: `${provider} generation`,
      model: mapToLangfuseModelId(modelId),
      usageDetails,
      costDetails,
      ...(startTimeMs ? { startTime: new Date(startTimeMs) } : {}),
      endTime: new Date(),
    });
  } catch (err) {
    console.warn('[pi-agent] Langfuse generation failed (non-fatal):', (err as Error).message);
  }
}

function makeResponseMeter() {
  const meter = { at: undefined as number | undefined, lastStatus: undefined as number | undefined };
  const onResponse = (response: { status: number }) => {
    meter.at = Date.now();
    meter.lastStatus = response.status;
    if (response.status >= 400) {
      console.warn(`[pi-agent] LLM sub-call responded ${response.status}${response.status === 429 ? ' (rate limited)' : response.status >= 500 ? ' (provider error)' : ''}`);
    }
  };
  return { meter, onResponse };
}

function openToolSpan(
  trace: LangfuseTraceClient | null,
  spans: Map<string, LangfuseSpanClient>,
  toolCallId: string,
  toolName: string,
  args: unknown,
): void {
  if (!trace) return;
  try {
    spans.set(toolCallId, trace.span({
      name: toolName,
      input: JSON.stringify(args ?? {}).slice(0, 2000),
    }));
  } catch (err) {
    console.warn('[pi-agent] Langfuse span open failed (non-fatal):', (err as Error).message);
  }
}

function closeToolSpan(
  spans: Map<string, LangfuseSpanClient>,
  toolCallId: string,
  isError: boolean,
  result?: unknown,
): void {
  const span = spans.get(toolCallId);
  if (!span) return;
  try {
    const output = result === undefined ? undefined : JSON.stringify(result).slice(0, 2000);
    span.end({ output, level: isError ? 'ERROR' : 'DEFAULT' });
  } catch (err) {
    console.warn('[pi-agent] Langfuse span close failed (non-fatal):', (err as Error).message);
  }
  spans.delete(toolCallId);
}

async function finishAgentTrace(trace: LangfuseTraceClient | null, outputText: string): Promise<string | null> {
  if (!trace) return null;
  try {
    trace.update({ output: outputText.slice(0, 2000) });
  } catch (err) {
    console.warn('[pi-agent] Langfuse trace update failed (non-fatal):', (err as Error).message);
  }
  try {
    await getLangfuse()?.flushAsync();
  } catch (err) {
    console.warn('[pi-agent] Langfuse flushAsync failed (non-fatal):', (err as Error).message);
  }
  return trace.id;
}

export interface RunAgentResult {
  text: string;
  usage?: Usage;
  timedOut?: boolean;
  langfuseTraceId?: string | null;
  error?: string;
}

function makeOutputCapHook(task: TaskLabel | undefined, explicit?: number) {
  const cap = explicit ?? (task ? pickModel(task).maxTokens : pickModel('chat').maxTokens);
  return (params: unknown) => {
    if (params && typeof params === 'object') {
      const p = params as Record<string, unknown>;
      p.max_tokens = typeof p.max_tokens === 'number' ? Math.min(p.max_tokens, cap) : cap;
    }
    return params;
  };
}

function shouldPersistMessage(message: unknown, attempt: number): boolean {
  const m = message as { role?: string; stopReason?: string };
  if (m.role === 'assistant' && m.stopReason === 'error') return false;
  if (attempt > 1 && m.role === 'user') return false;
  return true;
}

const STREAM_RETRY_DELAY_MS = 750;

function makeToolCallLimiter(maxToolCalls: number) {
  let attempted = 0;
  let warned = false;
  return async () => {
    attempted++;
    if (attempted <= maxToolCalls) return undefined;
    if (!warned) {
      warned = true;
      console.warn(`[pi-agent] tool call limit reached (${maxToolCalls}), blocking further calls to force synthesis`);
    }
    return {
      block: true,
      reason:
        `Tool-call budget for this turn is exhausted (${maxToolCalls} calls used). ` +
        'Do not request any more tools. Write your final answer NOW, synthesizing what you already gathered.',
    };
  };
}

export async function runAgent(prompt: string, options: RunAgentOptions = {}): Promise<RunAgentResult> {
  cleanStaleSessions();
  const model = resolveModel(options.task, options.modelOverride);

  const baseTools = options.tools !== false
    ? getTools({ projectId: options.projectId, step: options.step ?? options.task, userId: options.userId })
    : [];
  const extraTools = options.extraTools || [];
  const prior = resolveHistory(options);
  const outputCap = makeOutputCapHook(options.task, options.maxTokens);

  let fullText = '';
  let lastUsage: Usage | undefined;

  const trace = openAgentTrace(options, prompt);
  const toolSpans = new Map<string, LangfuseSpanClient>();

  const timeout = options.timeout || 120000;
  let timedOut = false;
  let currentAgent: Agent | null = null;

  let deadlineFired!: () => void;
  const deadline = new Promise<void>((resolve) => { deadlineFired = resolve; });
  const timer = setTimeout(() => {
    timedOut = true;
    console.warn(`[pi-agent] timeout (${timeout}ms) — aborting buffered agent run`);
    try { currentAgent?.abort(); } catch { /* ignore */ }
    deadlineFired();
  }, timeout);

  const runAttempt = async (attempt: number): Promise<{ errorStop: boolean; errorMessage?: string; toolsRan: boolean }> => {
    const { meter, onResponse } = makeResponseMeter();
    const agent = new Agent({
      streamFn: lpStreamFn,
      sessionId: options.sessionId,
      getApiKey: makeGetApiKey(options.userKey),
      onResponse,
      toolExecution: 'parallel',
      beforeToolCall: makeToolCallLimiter(options.maxToolCalls ?? 8),
      onPayload: outputCap,
    });
    currentAgent = agent;

    agent.state.model = model;
    if (options.systemPrompt) {
      agent.state.systemPrompt = options.systemPrompt;
    }
    if (baseTools.length > 0 || extraTools.length > 0) {
      agent.state.tools = [...baseTools, ...extraTools];
    }
    if (prior.length > 0) {
      agent.state.messages = [...prior];
    }

    let errorStop = false;
    let errorMessage: string | undefined;
    let toolsRan = false;

    agent.subscribe((event) => {
      if (event.type === 'message_update') {
        const evt = event.assistantMessageEvent;
        if (evt.type === 'text_delta') {
          fullText += evt.delta;
          options.onDelta?.(evt.delta);
        }
      }
      if (event.type === 'tool_execution_start') {
        toolsRan = true;
        openToolSpan(trace, toolSpans, event.toolCallId, event.toolName, event.args);
      }
      if (event.type === 'tool_execution_end') {
        closeToolSpan(toolSpans, event.toolCallId, event.isError, event.result);
      }
      if (event.type === 'message_end' && event.message) {
        const msg = event.message as { role?: string; stopReason?: string; errorMessage?: string };
        if (msg.role === 'assistant' && msg.stopReason === 'error') {
          errorStop = true;
          errorMessage = msg.errorMessage;
        }
        if ('usage' in event.message) {
          const usage = (event.message as any).usage;
          lastUsage = accumulateUsage(lastUsage, usage);
          recordGeneration(trace, model.provider, model.id, usage, meter.at);
        }
        if (options.sessionId && shouldPersistMessage(event.message, attempt)) {
          appendToSession(options.sessionId, event.message);
        }
      }
    });

    await Promise.race([
      (async () => { await agent.prompt(prompt); await agent.waitForIdle(); })(),
      deadline,
    ]);
    return { errorStop, errorMessage, toolsRan };
  };

  let finalError: string | undefined;
  try {
    let result = await runAttempt(1);
    if (result.errorStop && !timedOut && fullText === '' && !result.toolsRan) {
      console.warn(`[pi-agent] provider stream error before any output — retrying once`);
      await new Promise((r) => setTimeout(r, STREAM_RETRY_DELAY_MS));
      if (!timedOut) result = await runAttempt(2);
    }
    if (result.errorStop && fullText === '') {
      finalError = result.errorMessage || 'model stream failed';
    }
  } finally {
    clearTimeout(timer);
  }

  const langfuseTraceId = await finishAgentTrace(trace, fullText);
  return { text: fullText, usage: lastUsage, timedOut, langfuseTraceId, error: finalError };
}

export function runAgentStream(prompt: string, options: RunAgentOptions = {}): {
  stream: ReadableStream;
  cleanup: () => void;
} {
  cleanStaleSessions();
  const model = resolveModel(options.task, options.modelOverride);
  const encoder = new TextEncoder();
  let agent: Agent;

  const timeout = options.timeout || 120000;
  let timer: ReturnType<typeof setTimeout>;

  const stream = new ReadableStream({
    start(controller) {
      const baseToolsS = options.tools !== false
        ? getTools({ projectId: options.projectId, step: options.step ?? options.task, userId: options.userId })
        : [];
      const extraToolsS = options.extraTools || [];
      const prior = resolveHistory(options);
      const outputCap = makeOutputCapHook(options.task, options.maxTokens);

      let closed = false;
      let fullText = '';
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try { controller.enqueue(chunk); } catch { closed = true; }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      const trace = openAgentTrace(options, prompt);
      const toolSpans = new Map<string, LangfuseSpanClient>();

      timer = setTimeout(() => {
        console.warn(`[pi-agent] timeout (${timeout}ms) — aborting agent`);
        try { agent.abort(); } catch { /* ignore */ }
        let timeoutUsage: Record<string, unknown> | undefined;
        try {
          const model = resolveModel(options.task, options.modelOverride).id;
          if (lastUsage) {
            const u = lastUsage as unknown as Record<string, number | { total?: number } | undefined>;
            const partial = {
              input_tokens: (u.input as number) || 0,
              output_tokens: (u.output as number) || 0,
              cache_creation_input_tokens: (u.cacheWrite as number) || 0,
              cache_read_input_tokens: (u.cacheRead as number) || 0,
            };
            const existingCost = (u.cost as { total?: number } | undefined)?.total;
            const cost = (typeof existingCost === 'number' && existingCost > 0)
              ? existingCost
              : estimateCost('', model, partial);
            timeoutUsage = {
              ...partial,
              total_tokens: (u.totalTokens as number)
                || (partial.input_tokens + partial.output_tokens),
              cost,
              estimated: true,
            };
          } else {
            const outTok = Math.ceil((fullText.length || 0) / 4);
            const inChars = (prompt?.length || 0) + (options.systemPrompt?.length || 0);
            const inTok = Math.ceil(inChars / 4);
            const partial = {
              input_tokens: inTok,
              output_tokens: outTok,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            };
            timeoutUsage = {
              ...partial,
              total_tokens: inTok + outTok,
              cost: estimateCost('', model, partial),
              estimated: true,
            };
          }
        } catch {
          timeoutUsage = undefined;
        }
        finishAgentTrace(trace, fullText).then((langfuseTraceId) => {
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ done: true, timeout: true, fullText, usage: timeoutUsage, langfuseTraceId })}\n\n`));
          safeClose();
        });
      }, timeout);

      let lastUsage: Usage | undefined;

      const startAttempt = (attempt: number) => {
        const { meter, onResponse } = makeResponseMeter();
        agent = new Agent({
          streamFn: lpStreamFn,
          sessionId: options.sessionId,
          getApiKey: makeGetApiKey(options.userKey),
          onResponse,
          toolExecution: 'parallel',
          beforeToolCall: makeToolCallLimiter(options.maxToolCalls ?? 8),
          onPayload: outputCap,
        });

        agent.state.model = model;
        if (options.systemPrompt) {
          agent.state.systemPrompt = options.systemPrompt;
        }
        if (baseToolsS.length > 0 || extraToolsS.length > 0) {
          agent.state.tools = [...baseToolsS, ...extraToolsS];
        }
        if (prior.length > 0) {
          agent.state.messages = [...prior];
        }

        let sawErrorStop = false;
        let errorMessage: string | undefined;
        let toolsRan = false;
        const retryable = () =>
          sawErrorStop && !toolsRan && fullText === '' && attempt === 1 && !closed;

        agent.subscribe((event) => {
          switch (event.type) {
            case 'message_update': {
              const evt = event.assistantMessageEvent;
              if (evt.type === 'text_delta' && evt.delta) {
                fullText += evt.delta;
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: evt.delta })}\n\n`)
                );
              }
              break;
            }

            case 'tool_execution_start': {
              toolsRan = true;
              openToolSpan(trace, toolSpans, event.toolCallId, event.toolName, event.args);
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({
                  tool_start: {
                    id: event.toolCallId,
                    name: event.toolName,
                    args: event.args,
                  },
                })}\n\n`)
              );
              break;
            }

            case 'tool_execution_end': {
              closeToolSpan(toolSpans, event.toolCallId, event.isError, event.result);
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({
                  tool_end: {
                    id: event.toolCallId,
                    name: event.toolName,
                    error: event.isError,
                  },
                })}\n\n`)
              );
              break;
            }

            case 'message_end': {
              if (event.message) {
                const msg = event.message as { role?: string; stopReason?: string; errorMessage?: string };
                if (msg.role === 'assistant' && msg.stopReason === 'error') {
                  sawErrorStop = true;
                  errorMessage = msg.errorMessage;
                }
              }
              if (event.message && 'usage' in event.message) {
                const usage = (event.message as any).usage;
                lastUsage = accumulateUsage(lastUsage, usage);
                recordGeneration(trace, model.provider, model.id, usage, meter.at);
              }
              if (options.sessionId && event.message && shouldPersistMessage(event.message, attempt)) {
                appendToSession(options.sessionId, event.message);
              }
              break;
            }

            case 'agent_end': {
              if (retryable()) {
                console.warn(`[pi-agent] provider stream error before output — retrying`);
                setTimeout(() => { if (!closed) startAttempt(2); }, STREAM_RETRY_DELAY_MS);
                break;
              }
              clearTimeout(timer);
              const u = lastUsage as unknown as Record<string, number | { total?: number } | undefined>;
              finishAgentTrace(trace, fullText).then((langfuseTraceId) => {
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    done: true,
                    fullText,
                    ...(sawErrorStop ? { error: errorMessage || 'model stream failed', partial: fullText.length > 0 } : {}),
                    usage: lastUsage ? {
                      input_tokens: u.input as number,
                      output_tokens: u.output as number,
                      cache_creation_input_tokens: (u.cacheWrite as number) || 0,
                      cache_read_input_tokens: (u.cacheRead as number) || 0,
                      total_tokens: u.totalTokens as number,
                      cost: (u.cost as { total?: number } | undefined)?.total,
                    } : undefined,
                    langfuseTraceId,
                  })}\n\n`)
                );
                safeClose();
              });
              break;
            }
          }
        });

        agent.prompt(prompt).catch((err) => {
          if (retryable() || (!toolsRan && fullText === '' && attempt === 1 && !closed)) {
            console.warn(`[pi-agent] prompt() rejected before output — retrying`);
            setTimeout(() => { if (!closed) startAttempt(2); }, STREAM_RETRY_DELAY_MS);
            return;
          }
          clearTimeout(timer);
          const u = lastUsage as unknown as Record<string, number | { total?: number } | undefined> | undefined;
          finishAgentTrace(trace, fullText).then((langfuseTraceId) => {
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({
                done: true,
                error: err.message,
                usage: lastUsage && u ? {
                  input_tokens: u.input as number,
                  output_tokens: u.output as number,
                  cache_creation_input_tokens: (u.cacheWrite as number) || 0,
                  cache_read_input_tokens: (u.cacheRead as number) || 0,
                  total_tokens: u.totalTokens as number,
                  cost: (u.cost as { total?: number } | undefined)?.total,
                } : undefined,
                langfuseTraceId,
              })}\n\n`)
            );
            safeClose();
          });
        });
      };

      startAttempt(1);
    },
    cancel() {
      clearTimeout(timer);
      agent?.abort();
    },
  });

  return {
    stream,
    cleanup: () => {
      clearTimeout(timer);
      agent?.abort();
    },
  };
}
