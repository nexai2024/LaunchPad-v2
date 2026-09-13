/**
 * Prompt-cache breakpoint for the chat system prompt.
 * Kept for architectural interface compatibility.
 */

export const CACHE_BREAKPOINT = '<<<PI_CACHE_BREAKPOINT>>>';

export const CHAT_CACHE_SPLIT = false;

export function joinSystemForModel(staticHalf: string, volatileHalf: string): string {
  if (!volatileHalf) return staticHalf;
  return staticHalf + volatileHalf;
}

export function splitSystemForProvider(
  systemPrompt: string,
): { staticHalf: string; volatileHalf: string } | null {
  const i = systemPrompt.indexOf(CACHE_BREAKPOINT);
  if (i < 0) return null;
  return {
    staticHalf: systemPrompt.slice(0, i),
    volatileHalf: systemPrompt.slice(i + CACHE_BREAKPOINT.length),
  };
}

export function stripCacheBreakpoints(systemPrompt: string): string {
  return systemPrompt.split(CACHE_BREAKPOINT).join('');
}
