'use client';

/**
 * Co-pilot + Canvas Workspace — Slate & Blue Command Center.
 *
 * Integrated 3-in-1 layout:
 *   - Left 460px Workspace Column: Glowing prompt cards, message thread, & streamlined input composer.
 *   - Right Flex Live Canvas Column: Single-scroll live Canvas viewer (Canvas.tsx) showing real-time artifacts.
 */

import { use, useEffect, useState, useCallback, useMemo, useRef, createContext, useContext, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useT, useLocale } from '@/components/providers/LocaleProvider';
import type { MessageKey } from '@/lib/i18n/messages';
import { useChat, chatStoreHydrated, markChatHydrated } from '@/hooks/useChat';
import { broadcastPersistedArtifacts } from '@/hooks/usePersistedArtifact';
import { useStages } from '@/hooks/useStages';
import { requestRecharge } from '@/components/credits/recharge-events';
import { useProject } from '@/hooks/useProject';
import { useDraft } from '@/hooks/useDraft';
import { splitOptionLabel } from '@/components/chat/option-label';
import { IdeaShapingQuickReplies } from '@/components/chat/IdeaShapingQuickReplies';
import { parseMessageContent, normalizeCanvasJsonFences } from '@/lib/artifact-parser';
import { KNOWLEDGE_APPLY_CREDITS } from '@/lib/credit-costs';
import { pickCanvasCommitFields, droppedCanvasCommitFields } from '@/lib/canvas-commit';
import { ActionNotRun, isSilentReset } from '@/components/chat/action-errors';
import type { Artifact, ArtifactType, Department, ValidationProposalArtifact } from '@/types/artifacts';
import ValidationProposalCard from '@/components/chat/artifacts/ValidationProposalCard';
import MonitorProposalCard from '@/components/chat/artifacts/MonitorProposalCard';
import BudgetProposalCard from '@/components/chat/artifacts/BudgetProposalCard';
import { Canvas, type PendingPlaceholder } from '@/components/canvas/Canvas';
import AddDocumentsDialog from '@/components/knowledge/AddDocumentsDialog';
import { useSetChrome } from '@/components/design/chrome-context';
import { useKnowledgeCount } from '@/hooks/useKnowledgeCount';
import { checkActionPrompt, checkLabel, stageLabel, checkGap } from '@/lib/journey-prompts';
import { buildContextMarkdown } from '@/lib/context-export';
import { buildFinancialExport } from '@/lib/financial-export';
import type { ContextExportData } from '@/lib/context-export';
import { openPrintPreview } from '@/lib/print-utils';
import { ToolChips } from '@/components/ui/ToolChips';
import { TaskRows } from '@/components/ui/TaskRows';
import { StreamingText } from '@/components/ui/StreamingText';
import { LoadingState } from '@/components/ui/LoadingState';
import type { ToolActivity } from '@/types';
import {
  Pill,
  Icon,
  I,
  IconBtn,
} from '@/components/design/primitives';

const INLINE_ARTIFACT_TYPES = new Set<ArtifactType>([
  'option-set', 'action-suggestion', 'task',
  'monitor-proposal', 'budget-proposal', 'validation-proposal',
  'skill-suggestion', 'knowledge-suggestion',
]);

const GATE_ARTIFACT_TYPES = new Set<ArtifactType>([
  'validation-proposal',
]);
const SUGGESTION_ARTIFACT_TYPES = new Set<ArtifactType>([
  'option-set', 'action-suggestion', 'skill-suggestion', 'knowledge-suggestion',
]);

const VISIBLE_MESSAGE_TAIL = 25;
const NEAR_BOTTOM_PX = 150;
const PINNED_ARTIFACT_TYPES = new Set<ArtifactType>(['idea-canvas']);
const NON_CANVAS_TYPES = new Set<string>(['watch-source-proposal']);

const GatedSkillsContext = createContext<Set<string>>(new Set());

interface OptionSelectionState {
  selectedBySet: Record<string, string>;
  markSelected: (setId: string, optionId: string) => void;
  unmarkSelected: (setId: string) => void;
  streaming: boolean;
}
const OptionSelectionContext = createContext<OptionSelectionState>({
  selectedBySet: {},
  markSelected: () => {},
  unmarkSelected: () => {},
  streaming: false,
});

function useGatedSkills(projectId: string): Set<string> {
  const { data } = useQuery<string[]>({
    queryKey: ['skills', projectId, 'gated'],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/skills?availability=1`);
      const body = await res.json();
      return Array.isArray(body?.data?.gated) ? body.data.gated : [];
    },
  });
  return useMemo(() => new Set(data ?? []), [data]);
}

const ARTIFACT_CACHE_MAX = 300;
interface ClassifiedArtifacts {
  inline: Artifact[];
  canvas: Artifact[];
  inlineForDisplay: Artifact[];
  errors: Array<{ reason: string; artifact_type?: string }>;
}
const artifactCache = new Map<string, ClassifiedArtifacts>();
function classifyArtifactsCached(content: string): ClassifiedArtifacts {
  const hit = artifactCache.get(content);
  if (hit) return hit;
  const base = classifyArtifacts(content);
  const result: ClassifiedArtifacts = {
    ...base,
    inlineForDisplay: base.inline.some((a) => GATE_ARTIFACT_TYPES.has(a.type))
      ? base.inline.filter((a) => !SUGGESTION_ARTIFACT_TYPES.has(a.type))
      : base.inline,
  };
  if (artifactCache.size >= ARTIFACT_CACHE_MAX) {
    const oldest = artifactCache.keys().next().value;
    if (oldest !== undefined) artifactCache.delete(oldest);
  }
  artifactCache.set(content, result);
  return result;
}

function classifyArtifacts(content: string): {
  inline: Artifact[]; canvas: Artifact[]; errors: Array<{ reason: string; artifact_type?: string }>;
} {
  const segments = parseMessageContent(content);
  const all = segments
    .filter((s) => s.type === 'artifact')
    .map((s) => (s as { type: 'artifact'; artifact: Artifact }).artifact);
  const errors = segments
    .filter((s) => s.type === 'artifact-error')
    .map((s) => {
      const e = s as { reason: string; artifact_type?: string };
      return { reason: e.reason, artifact_type: e.artifact_type };
    });
  return {
    errors,
    inline: all.filter((a) => INLINE_ARTIFACT_TYPES.has(a.type)),
    canvas: all.filter(
      (a) =>
        !INLINE_ARTIFACT_TYPES.has(a.type) &&
        !PINNED_ARTIFACT_TYPES.has(a.type) &&
        !NON_CANVAS_TYPES.has(a.type as string),
    ),
  };
}

interface HistoryResp {
  success: boolean;
  data?: Array<{
    id: string; role: string; content: string; timestamp: string; tools_json?: string;
    meta?: { uncited_prose_claims?: boolean } | null;
  }>;
}

function ContextExportBtn({
  projectId,
  project,
  messages,
  artifacts,
  disabled,
}: {
  projectId: string;
  project: { name: string; status: string } | null;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  artifacts: Artifact[];
  disabled?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function gatherData(): Promise<ContextExportData> {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const artifactList = artifacts.map((a) => ({ type: a.type, title: (a as unknown as { title?: string }).title || a.id }));

    try {
      const res = await fetch(`/api/projects/${projectId}/context-export`);
      const body = await res.json();
      if (res.ok && body?.data) {
        const d = body.data;
        return {
          project: { name: d.project?.name || project?.name || '', description: d.project?.description, status: d.project?.status || project?.status || '' },
          date,
          score: d.score ?? null,
          stages: d.stages ?? [],
          facts: d.facts ?? [],
          alerts: d.alerts ?? [],
          nodes: d.nodes ?? [],
          briefs: d.briefs ?? [],
          tasks: d.tasks ?? [],
          risks: d.risks ?? [],
          artifacts: artifactList,
          messages: d.messages ?? messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
        };
      }
    } catch { /* fallback below */ }

    return {
      project: { name: project?.name || '', status: project?.status || '' },
      date,
      score: null,
      stages: [],
      facts: [],
      alerts: [],
      nodes: [],
      briefs: [],
      tasks: [],
      risks: [],
      artifacts: artifactList,
      messages: messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
    };
  }

  async function handleDownload() {
    setOpen(false);
    const data = await gatherData();
    const md = buildContextMarkdown(data);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project?.name || 'export').replace(/\s+/g, '-').toLowerCase()}-context-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconBtn
        d={I.download}
        title={t('chat.export-context')}
        onClick={() => setOpen((v) => !v)}
        style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            width: 170,
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--r-m)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 50,
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: '#F8FAFC',
              fontFamily: 'var(--f-sans)',
              textAlign: 'left',
            }}
          >
            <Icon d={I.download} size={14} stroke={1.4} />
            {t('chat.download-md')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CopilotChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const t = useT();
  const { project } = useProject(projectId);
  const gatedSkills = useGatedSkills(projectId);
  const step = 'chat';
  const { messages, isStreaming, sendMessage: sendMessageRaw, setMessages } = useChat(projectId, step);
  const [input, setInput, clearDraft] = useDraft(`lp_chat_draft_${projectId}`);
  const [targetCheck, setTargetCheck] = useState<string | null>(null);
  const [selectedBySet, setSelectedBySet] = useState<Record<string, string>>({});

  const markOptionSelected = useCallback((setId: string, optionId: string) => {
    if (!setId) return;
    setSelectedBySet((prev) => (prev[setId] !== undefined ? prev : { ...prev, [setId]: optionId }));
  }, []);

  const unmarkOptionSelected = useCallback((setId: string) => {
    if (!setId) return;
    setSelectedBySet((prev) => {
      if (prev[setId] === undefined) return prev;
      const next = { ...prev };
      delete next[setId];
      return next;
    });
  }, []);

  const optionSelection = useMemo<OptionSelectionState>(
    () => ({ selectedBySet, markSelected: markOptionSelected, unmarkSelected: unmarkOptionSelected, streaming: isStreaming }),
    [selectedBySet, markOptionSelected, unmarkOptionSelected, isStreaming],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('prefill');
    if (!prefill) return;
    setInput(prefill);
    setTargetCheck(params.get('check'));
    params.delete('prefill');
    params.delete('check');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, []);

  const [historyLoaded, setHistoryLoaded] = useState(() => chatStoreHydrated(projectId, step));
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [showAddDocs, setShowAddDocs] = useState(false);

  const [showAllMessages, setShowAllMessages] = useState(false);
  const hiddenCount = showAllMessages ? 0 : Math.max(0, messages.length - VISIBLE_MESSAGE_TAIL);
  const visibleMessages = useMemo(
    () => (hiddenCount > 0 ? messages.slice(hiddenCount) : messages),
    [messages, hiddenCount],
  );

  const isNearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const [showJumpPill, setShowJumpPill] = useState(false);

  const sendMessage = useCallback((content: string, targetCheck?: string | null, extra?: { chipCommit?: { canvas_fields: string[]; item_kinds: string[] } }) => {
    forceScrollRef.current = true;
    sendMessageRaw(content, targetCheck ?? null, extra);
    setTargetCheck(null);
  }, [sendMessageRaw]);

  useEffect(() => {
    if (chatStoreHydrated(projectId, step)) return;
    const controller = new AbortController();
    api.get<HistoryResp>(
      `/api/chat/history?project_id=${projectId}&step=${encodeURIComponent(step)}`,
      { signal: controller.signal, timeout: 15_000 },
    )
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (chatStoreHydrated(projectId, step)) return;
        const restored = data.success && Array.isArray(data.data) && data.data.length > 0
          ? data.data.map((m, i) => ({
            id: m.id ?? `restored_${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
            tools: m.tools_json ? JSON.parse(m.tools_json) : undefined,
            uncited_claims: !!(m.meta as { uncited_prose_claims?: boolean } | null)?.uncited_prose_claims,
          }))
          : [];
        forceScrollRef.current = true;
        setMessages(restored);
        markChatHydrated(projectId, step);
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHistoryLoaded(true);
      });
    return () => { controller.abort(); };
  }, [projectId, step, setMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (forceScrollRef.current || isNearBottomRef.current) {
      forceScrollRef.current = false;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    isNearBottomRef.current = near;
    setShowJumpPill(!near);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = true;
    forceScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    setShowJumpPill(false);
  }, []);

  interface CanvasEntry {
    artifact: Artifact;
    sourceMessageId: string;
    turnIndex: number;
  }
  const { canvasEntries, canvasArtifacts, inlineArtifactsByMsgId, artifactErrorsByMsgId, pendingPlaceholders } = useMemo(() => {
    const inlineMap = new Map<string, Artifact[]>();
    const errorMap = new Map<string, Array<{ reason: string; artifact_type?: string }>>();
    const canvasById = new Map<string, CanvasEntry>();
    let turnIndex = 0;
    for (const m of messages) {
      if (m.role !== 'assistant' || !m.content) continue;
      const split = classifyArtifactsCached(m.content);
      if (split.errors.length > 0) errorMap.set(m.id, split.errors);
      const inline = split.inlineForDisplay;
      if (inline.length > 0) inlineMap.set(m.id, inline);
      for (const a of split.canvas) {
        canvasById.set(a.id, { artifact: a, sourceMessageId: m.id, turnIndex });
      }
      if (split.canvas.length > 0) turnIndex++;
    }
    const entries = Array.from(canvasById.values());

    const placeholders: PendingPlaceholder[] = [];
    if (isStreaming) {
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && last.content) {
        for (const seg of parseMessageContent(last.content)) {
          if (seg.type !== 'artifact-pending' || !seg.header) continue;
          const { type, id, department } = seg.header;
          if (!type || !id || canvasById.has(id)) continue;
          const at = type as ArtifactType;
          if (
            INLINE_ARTIFACT_TYPES.has(at) ||
            PINNED_ARTIFACT_TYPES.has(at) ||
            NON_CANVAS_TYPES.has(type) ||
            type === 'solve-progress'
          ) continue;
          placeholders.push({
            id,
            type,
            department: (department as Department | undefined) ?? 'market',
          });
        }
      }
    }

    return {
      canvasEntries: entries,
      canvasArtifacts: entries.map((e) => e.artifact),
      inlineArtifactsByMsgId: inlineMap,
      artifactErrorsByMsgId: errorMap,
      pendingPlaceholders: placeholders,
    };
  }, [messages, isStreaming]);

  function handleSend() {
    const v = input.trim();
    if (!v || isStreaming) return;
    sendMessage(v, targetCheck);
    clearDraft();
  }

  const handleMessageFocus = useCallback((id: string, focused: boolean) => {
    setFocusedMessageId((prev) => (focused ? id : prev === id ? null : prev));
  }, []);

  const handleArtifactAction = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<void> => {
      if (action === 'knowledge:apply') {
        const itemId = String(payload.item_id ?? '');
        if (!itemId) throw new Error('Missing item_id on knowledge:apply');
        const state = payload.state === 'rejected' ? 'rejected' : 'applied';
        const res = await fetch(
          `/api/projects/${projectId}/knowledge/${encodeURIComponent(itemId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state }),
          },
        );
        if (!res.ok) throw new Error(`Knowledge ${state} failed`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lp-actions-changed', { detail: { projectId } }));
          window.dispatchEvent(new CustomEvent('lp-knowledge-changed', { detail: { projectId } }));
        }
        return;
      }
    },
    [projectId],
  );

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  useSetChrome(
    {
      breadcrumb: [project?.name || '', t('chat.breadcrumb-copilot')],
      right: (
        <>
          {isStreaming && <Pill kind="live" dot>{t('chat.streaming')}</Pill>}
          <ContextExportBtn
            projectId={projectId}
            project={project}
            messages={messages}
            artifacts={canvasArtifacts}
            disabled={isStreaming}
          />
        </>
      ),
      status: { heartbeatLabel: isStreaming ? t('chat.status-streaming') : t('chat.status-idle') },
      chatStreaming: isStreaming,
    },
    [project, isStreaming, messages, canvasArtifacts],
  );

  const locale = (project as unknown as { locale?: string })?.locale === 'it' ? 'it' : 'en';

  return (
    <GatedSkillsContext.Provider value={gatedSkills}>
      <OptionSelectionContext.Provider value={optionSelection}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0, background: 'var(--paper)' }}>
          {/* Chat / Co-Pilot Workspace Column */}
          <div
            style={{
              width: 460,
              flexShrink: 0,
              borderRight: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(180deg, #0F172A 0%, #0B0F17 100%)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: '#3B82F6',
                      boxShadow: '0 0 10px #3B82F6',
                    }}
                  />
                  <h2
                    className="lp-serif"
                    style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}
                  >
                    AI Co-Pilot Workspace
                  </h2>
                </div>
              </div>
            </div>

            {/* Messages Thread */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div
                ref={scrollRef}
                className="lp-scroll"
                onScroll={handleScroll}
                style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}
              >
                {!historyLoaded && messages.length === 0 ? (
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
                    <LoadingState label={t('chat.loading-history')} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
                      Start validating your idea with AI guidance.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => setInput('Help me map out the 9 blocks of my Lean Canvas.')}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(30, 41, 59, 0.7)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#E2E8F0',
                          fontSize: 12,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Fill Lean Canvas
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {visibleMessages.map((m) => (
                      <Msg
                        key={m.id}
                        messageId={m.id}
                        who={m.role === 'user' ? 'user' : 'ai'}
                        agent="Chief"
                        streaming={m.role === 'assistant' && isStreaming && m === messages[messages.length - 1]}
                        tools={m.tools}
                        uncitedClaims={m.uncited_claims}
                        artifactErrors={artifactErrorsByMsgId.get(m.id)}
                        rawContent={m.content}
                        inlineArtifacts={inlineArtifactsByMsgId.get(m.id)}
                        onArtifactAction={handleArtifactAction}
                        onFocusChange={handleMessageFocus}
                        onRetry={m.role === 'user' && !isStreaming ? sendMessage : undefined}
                      >
                        {stripArtifacts(m.content)}
                      </Msg>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Quick Replies */}
            <IdeaShapingQuickReplies
              projectId={projectId}
              onReply={!isStreaming ? sendMessage : undefined}
              hasHistory={messages.length > 0}
            />

            {/* Input Composer */}
            <div style={{ padding: 14, borderTop: '1px solid var(--line)', background: 'rgba(15, 23, 42, 0.8)' }}>
              <div
                style={{
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 10,
                  padding: 10,
                  background: '#0B0F17',
                  boxShadow: '0 0 14px rgba(59, 130, 246, 0.15)',
                }}
              >
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={t('chat.composer-placeholder')}
                  rows={2}
                  disabled={isStreaming}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    resize: 'none',
                    fontSize: 13,
                    color: '#F8FAFC',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Press Enter to send</span>
                  <button
                    onClick={handleSend}
                    disabled={isStreaming || !input.trim()}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: isStreaming || !input.trim() ? 0.5 : 1,
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Interactive Right Column */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              background: '#0B0F17',
            }}
          >
            <Canvas
              projectId={projectId}
              locale={locale}
              canvasEntries={canvasEntries}
              pendingPlaceholders={pendingPlaceholders}
              messages={messages}
              handleArtifactAction={handleArtifactAction}
              focusedMessageId={focusedMessageId}
              onPickPrompt={(prompt, checkId) => {
                setTargetCheck(checkId ?? null);
                setInput(prompt);
                composerRef.current?.focus();
              }}
            />
          </div>
        </div>
      </OptionSelectionContext.Provider>
    </GatedSkillsContext.Provider>
  );
}

function MsgImpl({
  messageId,
  who,
  agent,
  streaming,
  tools,
  children,
  rawContent,
  inlineArtifacts,
  onArtifactAction,
  onRetry,
  onFocusChange,
  uncitedClaims,
  artifactErrors,
}: {
  messageId: string;
  who: 'user' | 'ai';
  agent: string;
  streaming?: boolean;
  tools?: ToolActivity[];
  children: React.ReactNode;
  rawContent: string;
  inlineArtifacts?: Artifact[];
  onArtifactAction?: (action: string, payload: Record<string, unknown>) => Promise<void> | void;
  onRetry?: (content: string) => void;
  onFocusChange?: (id: string, focused: boolean) => void;
  uncitedClaims?: boolean;
  artifactErrors?: Array<{ reason: string; artifact_type?: string }>;
}) {
  const t = useT();

  if (who === 'user') {
    return (
      <div
        className="lp-msg-row lp-rise"
        data-message-id={messageId}
        onMouseEnter={() => onFocusChange?.(messageId, true)}
        onMouseLeave={() => onFocusChange?.(messageId, false)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16 }}
      >
        <div
          style={{
            maxWidth: '85%',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
            color: '#FFFFFF',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-rise" data-message-id={messageId} onMouseEnter={() => onFocusChange?.(messageId, true)} onMouseLeave={() => onFocusChange?.(messageId, false)} style={{ marginBottom: 18, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: 'var(--sky)',
            color: 'var(--on-accent)',
            fontSize: 9,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--f-mono)',
          }}
        >
          {agent.slice(0, 2).toUpperCase()}
        </span>
        {streaming && <Pill kind="live" dot>{t('chat.streaming')}</Pill>}
      </div>

      <div
        className="lp-msg-row lp-md"
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: '#1E293B',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: 13,
          lineHeight: 1.55,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        <StreamingText
          className="w-full"
          text={String(children ?? '')}
          streaming={streaming}
          renderText={(visible) => <MdProse text={visible} />}
        />
      </div>

      {!streaming && artifactErrors && artifactErrors.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {artifactErrors.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '8px 10px', borderRadius: 'var(--r-m)',
                border: '1px solid var(--clay)', background: 'var(--clay-wash)',
                fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink-2)',
              }}
            >
              <Icon d={I.x} size={11} stroke={1.6} style={{ color: 'var(--clay)', flexShrink: 0, marginTop: 2 }} />
              <span>{t('chat.card-rejected', { type: e.artifact_type ?? '—' })}</span>
            </div>
          ))}
        </div>
      )}

      {!streaming && uncitedClaims && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--ink-4)',
          }}
        >
          <Icon d={I.flag} size={11} stroke={1.5} style={{ color: 'var(--clay)', flexShrink: 0, marginTop: 2 }} />
          <span>{t('chat.uncited-claim')}</span>
        </div>
      )}
    </div>
  );
}

const Msg = memo(MsgImpl);

function MdProse({ text }: { text: string }) {
  return <span>{text}</span>;
}

function stripArtifacts(content: string): string {
  return normalizeCanvasJsonFences(content)
    .replace(/:::artifact[\s\S]*?(?::::|$)/g, '')
    .replace(/<CITATIONS>[\s\S]*?(?:<\/CITATIONS>|$)/g, '')
    .trim();
}
