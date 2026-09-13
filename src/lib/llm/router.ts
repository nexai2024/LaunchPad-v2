/**
 * Task-complexity-based model router.
 * Standardized on OpenAI as the primary AI provider.
 */

import { MODEL_CONFIG, TIER_DEFAULTS } from './models';

export type ModelTier = 'cheap' | 'balanced' | 'premium';

export type TaskLabel =
  | 'chat'               // Pi Agent interactive chat
  | 'monitor-agent'      // Pi Agent cron / monitor run (web-browse + parse)
  | 'scoring'            // startup scoring (numeric across dimensions)
  | 'research'           // market research
  | 'simulation'         // persona simulation
  | 'pitch-iterate'      // pitch deck revision
  | 'term-sheet'         // term sheet analysis
  | 'investor-update'    // summarize progress for investors (cheap)
  | 'scaling-plan'       // 3-year strategic horizon (premium)
  | 'milestones'         // 52-week detailed roadmap (premium)
  | 'update-generate'    // journey update (cheap)
  | 'growth-iterate'     // growth loop hypothesis
  | 'growth-synthesize'  // growth pattern synthesis
  | 'summarize'          // generic summarization
  | 'classify'           // generic classification
  | 'heartbeat-reflect'  // daily agent self-reflection
  | 'heartbeat-propose'  // daily heartbeat task proposer (cheap)
  | 'skill-invoke'       // agent invoking a registered skill as a tool
  | 'risk-analysis'      // structured risk audit
  | 'task-expand'        // task-expansion turn
  | 'signal-classify'    // watch-source change classification (cheap)
  | 'signal-correlate'   // cross-signal correlation synthesis
  | 'skill-premium'      // premium-tier skill runs
  | 'chat-followup'      // simple chat follow-ups
  | 'assumption-extract'; // assumption extractor pass

type ResolvedModel = {
  provider: 'openai';
  model: string;
  tier: ModelTier;
  maxTokens: number;
};

export const LLM_PROVIDER: 'openai' = 'openai';

const TIER_MODELS: Record<ModelTier, { provider: 'openai'; model: string }> = (() => {
  const result = {} as Record<ModelTier, { provider: 'openai'; model: string }>;
  for (const cfg of Object.values(MODEL_CONFIG)) {
    if ((cfg as { legacy?: boolean }).legacy) continue;
    result[cfg.tier] = { provider: 'openai', model: cfg.id };
  }
  return result;
})();

const DEFAULT_TASK_TIER: Partial<Record<TaskLabel, ModelTier>> = {
  classify: 'cheap',
  summarize: 'cheap',
  'update-generate': 'cheap',
  'investor-update': 'cheap',
  'heartbeat-propose': 'cheap',
  'scaling-plan': 'premium',
  milestones: 'premium',
  'task-expand': 'cheap',
  'signal-classify': 'cheap',
  'chat-followup': 'cheap',
  'skill-premium': 'premium',
};

let cachedOverride: { raw: string | undefined; parsed: Partial<Record<string, ModelTier>> } = {
  raw: null as never,
  parsed: {},
};

function loadOverride(): Partial<Record<string, ModelTier>> {
  const raw = process.env.LLM_ROUTING_JSON;
  if (raw === cachedOverride.raw) return cachedOverride.parsed;

  cachedOverride.raw = raw;
  cachedOverride.parsed = {};
  if (!raw) return cachedOverride.parsed;

  try {
    const parsed = JSON.parse(raw);
    for (const [task, tier] of Object.entries(parsed)) {
      if (tier === 'cheap' || tier === 'balanced' || tier === 'premium') {
        cachedOverride.parsed[task] = tier;
      }
    }
  } catch (err) {
    console.warn('[llm/router] Failed to parse LLM_ROUTING_JSON, ignoring:', err);
  }
  return cachedOverride.parsed;
}

export function pickModel(task: TaskLabel | string): ResolvedModel {
  const override = loadOverride();
  const tier: ModelTier =
    override[task] ??
    DEFAULT_TASK_TIER[task as TaskLabel] ??
    'balanced';

  const { provider, model } = TIER_MODELS[tier];
  const { maxTokens } = TIER_DEFAULTS[tier];
  return { provider, model, tier, maxTokens };
}

export function modelForKey(key: string): { provider: 'openai'; model: string } | null {
  const cfg = (MODEL_CONFIG as Record<string, (typeof MODEL_CONFIG)[keyof typeof MODEL_CONFIG] & { legacy?: boolean }>)[key];
  if (!cfg || cfg.legacy) return null;
  return { provider: 'openai', model: cfg.id };
}

export function _resetRouterCache() {
  cachedOverride = { raw: null as never, parsed: {} };
}
