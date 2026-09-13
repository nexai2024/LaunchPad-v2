import { describe, it, expect } from 'vitest';
import {
  CACHE_BREAKPOINT,
  joinSystemForModel,
  splitSystemForProvider,
  stripCacheBreakpoints,
} from '@/lib/chat/cache-breakpoint';
import { buildSystemPromptString } from '@/lib/agent-prompt';

const STATIC = 'SOUL\n\n---\n\nAGENTS\n\n---\n\nARTIFACT_INSTRUCTIONS\n\nJOURNEY_RULES';
const VOLATILE = '\n\n[MEMORY CONTEXT]\nturns: 3\n[STEER]\nclose check X';

describe('cache breakpoint — content preservation', () => {
  it('round-trips to the exact original bytes', () => {
    const joined = STATIC + CACHE_BREAKPOINT + VOLATILE;
    const parts = splitSystemForProvider(joined);
    expect(parts).not.toBeNull();
    expect(parts!.staticHalf + parts!.volatileHalf).toBe(STATIC + VOLATILE);
  });

  it('what the model sees is identical with and without the marker', () => {
    const withMarker = splitSystemForProvider(STATIC + CACHE_BREAKPOINT + VOLATILE)!;
    expect(withMarker.staticHalf + withMarker.volatileHalf).toBe(
      joinSystemForModel(STATIC, VOLATILE).replace(CACHE_BREAKPOINT, ''),
    );
  });

  it('puts the boundary exactly where the static half ends', () => {
    const p = splitSystemForProvider(STATIC + CACHE_BREAKPOINT + VOLATILE)!;
    expect(p.staticHalf).toBe(STATIC);
    expect(p.volatileHalf).toBe(VOLATILE);
  });
});

describe('cache breakpoint — fail-safe behaviour', () => {
  it('returns null for an unmarked prompt so callers keep their single-block path', () => {
    expect(splitSystemForProvider(STATIC + VOLATILE)).toBeNull();
    expect(splitSystemForProvider('')).toBeNull();
  });

  it('never leaves a sentinel where the model could read it', () => {
    const joined = STATIC + CACHE_BREAKPOINT + VOLATILE;
    expect(stripCacheBreakpoints(joined)).toBe(STATIC + VOLATILE);
    expect(stripCacheBreakpoints(joined)).not.toContain(CACHE_BREAKPOINT);
    const doubled = `${STATIC}${CACHE_BREAKPOINT}mid${CACHE_BREAKPOINT}${VOLATILE}`;
    expect(stripCacheBreakpoints(doubled)).not.toContain(CACHE_BREAKPOINT);
  });

  it('emits no marker when there is no volatile half to separate', () => {
    expect(joinSystemForModel(STATIC, '')).toBe(STATIC);
    expect(joinSystemForModel(STATIC, '')).not.toContain(CACHE_BREAKPOINT);
  });

  it('is byte-identical to plain concatenation when the split is inactive', () => {
    expect(joinSystemForModel(STATIC, VOLATILE)).toBe(STATIC + VOLATILE);
    expect(joinSystemForModel(STATIC, VOLATILE)).not.toContain(CACHE_BREAKPOINT);
  });

  it('the route\'s two-half assembly is byte-identical to the old one-call build', () => {
    const tail = 'ARTIFACT_INSTRUCTIONS\n\nJOURNEY_RULES';
    const dynamicContext = '[JOURNEY STAGE] 3 open\n[MEMORY CONTEXT] ...';

    const before = buildSystemPromptString({ locale: 'en', context: 'chat', tail, projectContext: dynamicContext });
    const staticHalf = buildSystemPromptString({ locale: 'en', context: 'chat', tail, projectContext: '' });
    const after = joinSystemForModel(staticHalf, `\n\n${dynamicContext}`);

    expect(after).toBe(before);
  });

  it('holds for the empty-dynamic-context case too', () => {
    const tail = 'ARTIFACT_INSTRUCTIONS';
    const before = buildSystemPromptString({ locale: 'en', context: 'chat', tail, projectContext: '' });
    const after = joinSystemForModel(before, '');
    expect(after).toBe(before);
  });

  it('uses a sentinel that cannot collide with real prompt content', () => {
    expect(CACHE_BREAKPOINT).toMatch(/^<{3}[A-Z_]+>{3}$/);
    expect(CACHE_BREAKPOINT).not.toMatch(/[^\x20-\x7E]/);
  });
});
