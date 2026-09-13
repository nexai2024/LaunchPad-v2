/**
 * Central model configuration — single source of truth for model IDs,
 * pricing, and tier defaults across the entire codebase.
 * Standardized on OpenAI as the primary AI provider.
 *
 * Referenced by:
 *   - src/lib/llm/router.ts  (tier → model resolution)
 *   - src/lib/llm/index.ts   (tier-appropriate maxTokens defaults)
 *   - src/lib/telemetry.ts   (cost estimation)
 */

export const MODEL_CONFIG = {
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    openrouterId: 'openai/gpt-4o-mini',
    tier: 'cheap' as const,
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: {
      input: 0.15,
      output: 0.60,
      cacheWrite: 0.15,
      cacheRead: 0.075,
    },
  },
  'gpt-4o': {
    id: 'gpt-4o',
    openrouterId: 'openai/gpt-4o',
    tier: 'balanced' as const,
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: {
      input: 2.50,
      output: 10.00,
      cacheWrite: 2.50,
      cacheRead: 1.25,
    },
  },
  'o3-mini': {
    id: 'o3-mini',
    openrouterId: 'openai/o3-mini',
    tier: 'premium' as const,
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    pricing: {
      input: 1.10,
      output: 4.40,
      cacheWrite: 1.10,
      cacheRead: 0.55,
    },
  },
  // Historical entries for pricing compatibility on telemetry rows
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5-20251001',
    openrouterId: 'anthropic/claude-haiku-4.5',
    tier: 'cheap' as const,
    legacy: true,
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    pricing: {
      input: 1.00,
      output: 5.00,
      cacheWrite: 1.25,
      cacheRead: 0.10,
    },
  },
  'claude-sonnet-5': {
    id: 'claude-sonnet-5',
    openrouterId: 'anthropic/claude-sonnet-5',
    tier: 'balanced' as const,
    legacy: true,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    pricing: {
      input: 2.00,
      output: 10.00,
      cacheWrite: 2.50,
      cacheRead: 0.20,
    },
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    openrouterId: 'anthropic/claude-sonnet-4.6',
    tier: 'balanced' as const,
    legacy: true,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    pricing: {
      input: 3.00,
      output: 15.00,
      cacheWrite: 3.75,
      cacheRead: 0.30,
    },
  },
  'claude-opus-4-7': {
    id: 'claude-opus-4-7',
    openrouterId: 'anthropic/claude-opus-4.7',
    tier: 'premium' as const,
    legacy: true,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: {
      input: 5.00,
      output: 25.00,
      cacheWrite: 6.25,
      cacheRead: 0.50,
    },
  },
} as const;

export type ModelKey = keyof typeof MODEL_CONFIG;

// Tier → sensible default maxTokens for API calls (not model max, but a practical default)
export const TIER_DEFAULTS = {
  cheap: { maxTokens: 4_096, temperature: 0.7 },
  balanced: { maxTokens: 8_192, temperature: 0.7 },
  premium: { maxTokens: 16_384, temperature: 0.7 },
} as const;

/**
 * Resolve a MODEL_CONFIG entry from any known model ID string.
 */
export function getModelConfig(modelId: string) {
  for (const [key, cfg] of Object.entries(MODEL_CONFIG)) {
    if (key === modelId || cfg.id === modelId || cfg.openrouterId === modelId) {
      return cfg;
    }
  }
  return null;
}
