import OpenAI from 'openai';
import { pickModel, type TaskLabel } from './router';
import { MODEL_CONFIG } from './models';
import { recordUsage } from '@/lib/cost-meter';
import { estimateCost } from '@/lib/telemetry';

const FALLBACK_OPENAI_MODEL = MODEL_CONFIG['gpt-4o'].id;

let _openai: OpenAI | null = null;

function getOpenAI(apiKeyOverride?: string): OpenAI {
  if (apiKeyOverride) {
    return new OpenAI({ apiKey: apiKeyOverride });
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'unused' });
  }
  return _openai;
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

/** Per-request overrides for BYOK. */
export interface UserKeyOverride {
  provider: 'openai';
  apiKey: string;
}

export async function chat(
  messages: Message[],
  provider = 'openai',
  temperature = 0.7,
  maxTokens = 4096,
  model?: string,
  userKey?: UserKeyOverride,
): Promise<string> {
  const { text } = await chatWithUsage(messages, provider, temperature, maxTokens, model, userKey);
  return text;
}

export async function chatJSON<T = Record<string, unknown>>(
  messages: Message[],
  provider = 'openai',
  temperature = 0.3,
  model?: string,
): Promise<T> {
  const raw = await chat(messages, provider, temperature, 4096, model);
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
  return JSON.parse(cleaned.trim());
}

export async function chatJSONByTask<T = Record<string, unknown>>(
  messages: Message[],
  task: TaskLabel | string,
  opts: { projectId: string; temperature?: number; userKey?: UserKeyOverride },
): Promise<T> {
  const { provider, model, maxTokens } = pickModel(task);
  const startedAt = Date.now();
  const { text: raw, usage } = await chatWithUsage(
    messages, provider, opts.temperature ?? 0.3, maxTokens, model, opts.userKey,
  );
  const latencyMs = Date.now() - startedAt;

  if (opts.projectId) {
    const costUsd = typeof usage.cost_usd === 'number'
      ? usage.cost_usd
      : estimateCost(provider, model, {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
        });
    recordUsage({
      project_id: opts.projectId,
      step: task,
      provider: 'openai',
      model,
      usage: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cacheCreation: usage.cache_creation_input_tokens,
        cacheRead: usage.cache_read_input_tokens,
        cost: { total: costUsd },
      } as any,
      latency_ms: latencyMs,
      ...(opts.userKey ? { key_source: 'user' } : {}),
    }).catch(err => console.warn(`[${task}] recordUsage failed:`, (err as Error).message));
  }

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
  return JSON.parse(cleaned.trim());
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cost_usd?: number;
}

export async function chatWithUsage(
  messages: Message[],
  provider = 'openai',
  temperature = 0.7,
  maxTokens = 4096,
  model?: string,
  userKey?: UserKeyOverride,
): Promise<{ text: string; usage: LLMUsage }> {
  const openaiKey = userKey?.apiKey;
  const client = getOpenAI(openaiKey);
  const resolvedModel = model || process.env.OPENAI_MODEL || FALLBACK_OPENAI_MODEL;

  const response = await client.chat.completions.create({
    model: resolvedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  const text = response.choices[0]?.message?.content || '';
  const u = response.usage;
  const cachedTokens = (u as unknown as { prompt_tokens_details?: { cached_tokens?: number } })
    ?.prompt_tokens_details?.cached_tokens ?? 0;
  const providerCost = (u as unknown as { cost?: number })?.cost;

  return {
    text,
    usage: {
      input_tokens: u?.prompt_tokens ?? 0,
      output_tokens: u?.completion_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: cachedTokens,
      ...(typeof providerCost === 'number' ? { cost_usd: providerCost } : {}),
    },
  };
}

export async function* chatStream(
  messages: Message[],
  provider = 'openai',
  temperature = 0.7,
  maxTokens = 4096,
  userKey?: UserKeyOverride,
): AsyncGenerator<string> {
  const openaiKey = userKey?.apiKey;
  const client = getOpenAI(openaiKey);
  const resolvedModel = process.env.OPENAI_MODEL || FALLBACK_OPENAI_MODEL;

  const stream = await client.chat.completions.create({
    model: resolvedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) { yield delta; }
  }
}
