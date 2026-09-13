'use client';

/**
 * Today — Slate & Blue Command Hub Dashboard.
 *
 * Integrated layout:
 *   - Hero Status Banner: Radial/bar visual metrics, current active gate status, and priority actions.
 *   - Two-column Command Grid:
 *       primary   → Phase Spine, StageCard & Loop History.
 *       secondary → Active Watchers, Inbox Feed, and Notes.
 *   - Full-width Ecosystem Graph card.
 */

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSetChrome } from '@/components/design/chrome-context';
import { useT } from '@/components/providers/LocaleProvider';
import type { MessageKey, TranslateVars } from '@/lib/i18n/messages';
import { Icon, I } from '@/components/design/primitives';
import { PanelBoundary } from '@/components/design/PanelBoundary';
import { useOpenActionCount } from '@/hooks/useOpenActionCount';
import { StageCard } from '@/components/stages/StageCard';
import { LoopHistoryCard } from '@/components/journey/LoopHistoryCard';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { NotesCard } from '@/components/onboarding/NotesCard';
import { ScorePanel } from '@/components/home/ScorePanel';
import { LoopStatusRow } from '@/components/loops/LoopStatusRow';
import { PhaseSpine } from '@/components/journey/PhaseSpine';
import { EcosystemPanel } from '@/components/home/EcosystemPanel';
import MonitorListPanel from '@/components/monitors/MonitorListPanel';
import { laneFor, isIntelInboxType } from '@/lib/action-lanes';
import type { PendingActionType } from '@/types';
import { LoadingState } from '@/components/ui/LoadingState';

const INTEL_HIDDEN = process.env.NEXT_PUBLIC_INTEL_HIDDEN === '1';

interface PendingAction {
  id: string;
  action_type: PendingActionType;
  title: string;
  created_at: string;
}

export default function TodayPage({ params }: { params: Promise<{ projectId: string }> }) {
  const t = useT();
  const { projectId } = use(params);
  const { count: inboxBadge } = useOpenActionCount(projectId);

  const { data: actionsList, isLoading: actionsLoading, isError: actionsError } = useQuery<PendingAction[]>({
    queryKey: ['actions', projectId, 'preview'],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/actions?status=pending,edited&limit=50`);
      if (!res.ok) throw new Error(`actions fetch failed: ${res.status}`);
      const body = await res.json();
      if (!body.success || !Array.isArray(body.data?.actions)) throw new Error('actions fetch failed: bad payload');
      return body.data.actions as PendingAction[];
    },
  });

  const allPending = actionsList ?? [];
  const intelPending = allPending.filter((a) => isIntelInboxType(a.action_type));
  const actions = intelPending.slice(0, 3);
  const signalCount = allPending.filter((a) => laneFor(a.action_type) === 'signal').length;

  const { data: watchers } = useQuery<{ id: string }[]>({
    queryKey: ['watchers', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/watchers`);
      const body = await res.json();
      if (!body.success || !Array.isArray(body.data)) return [];
      return body.data as { id: string }[];
    },
  });
  const hasWatchers = (watchers?.length ?? 0) > 0;

  useSetChrome(
    {
      breadcrumb: [t('today.breadcrumb-project'), t('today.breadcrumb-home')],
      status: {
        heartbeatLabel: hasWatchers ? t('today.watchers-cadence') : t('today.watchers-none'),
        heartbeatKind: hasWatchers ? 'healthy' : 'stale',
        ctxLabel: t('today.signals-to-review', { count: signalCount }),
        budget: t('today.pending-count', { count: inboxBadge }),
      },
    },
    [inboxBadge, signalCount, hasWatchers, t],
  );

  return (
    <div
      className="lp-rise"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
        background: 'var(--paper)',
      }}
    >
      {/* Command Hub Header Banner */}
      <header
        style={{
          marginBottom: 24,
          padding: '20px 24px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#60A5FA',
                background: 'rgba(59, 130, 246, 0.15)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              COMMAND HUB
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Project Dashboard</span>
          </div>
          <h1
            className="lp-serif"
            style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}
          >
            {greeting(t)}.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>
            {actionsError ? t('today.status-unavailable') : summarize(t, inboxBadge, signalCount)}
          </p>
        </div>

        {/* Action Triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href={`/project/${projectId}/chat`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Icon d={I.chat} size={14} />
            <span>Open Co-Pilot</span>
          </Link>
          <Link
            href={`/project/${projectId}/actions`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(30, 41, 59, 0.8)',
              color: 'var(--ink-2)',
              border: '1px solid var(--line-2)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Icon d={I.tickets} size={14} />
            <span>Inbox ({inboxBadge})</span>
          </Link>
        </div>
      </header>

      {actionsLoading && !actionsList ? (
        <SkeletonRow />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PanelBoundary resetKey={projectId}>
            <OnboardingCard projectId={projectId} />
          </PanelBoundary>
          <PanelBoundary resetKey={projectId}>
            <ScorePanel projectId={projectId} />
          </PanelBoundary>

          <PanelBoundary resetKey={projectId}>
            <LoopStatusRow projectId={projectId} />
          </PanelBoundary>

          <div className="lp-home-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <PanelBoundary resetKey={projectId}>
                <PhaseSpine projectId={projectId} />
              </PanelBoundary>
              <PanelBoundary resetKey={projectId}>
                <StageCard projectId={projectId} />
              </PanelBoundary>
              <PanelBoundary resetKey={projectId}>
                <LoopHistoryCard projectId={projectId} />
              </PanelBoundary>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <PanelBoundary resetKey={projectId}>
                <Panel
                  dataTour="watchers-panel"
                  label={t('today.watchers')}
                  icon={I.signal}
                  href={`/project/${projectId}/actions?lane=monitor`}
                  hrefLabel={t('today.open-inbox')}
                  empty={null}
                >
                  <MonitorListPanel projectId={projectId} compact limit={4} title="" />
                  {signalCount > 0 && (
                    <Link
                      href={`/project/${projectId}/actions?lane=signal`}
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        fontSize: 11,
                        color: 'var(--accent-ink)',
                        textDecoration: 'none',
                        fontFamily: 'var(--f-mono)',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      {t('today.signals-awaiting-review', { count: signalCount })}
                    </Link>
                  )}
                </Panel>
              </PanelBoundary>
              {!INTEL_HIDDEN && (
                <PanelBoundary resetKey={projectId}>
                  <InboxPanel projectId={projectId} actions={actions} totalCount={intelPending.length} errored={actionsError} />
                </PanelBoundary>
              )}
              <PanelBoundary resetKey={projectId}>
                <NotesCard projectId={projectId} />
              </PanelBoundary>
            </div>
          </div>

          <PanelBoundary resetKey={projectId}>
            <EcosystemPanel projectId={projectId} />
          </PanelBoundary>
        </div>
      )}
    </div>
  );
}

function InboxPanel({
  projectId,
  actions,
  totalCount,
  errored = false,
}: {
  projectId: string;
  actions: PendingAction[];
  totalCount: number;
  errored?: boolean;
}) {
  const t = useT();
  const extra = Math.max(0, totalCount - actions.length);
  return (
    <Panel
      label={t('today.inbox')}
      icon={I.tickets}
      href={`/project/${projectId}/actions`}
      hrefLabel={totalCount > 0 ? t('today.view-all', { count: totalCount }) : t('today.open-inbox-lower')}
      empty={errored ? t('common.panel-error') : actions.length === 0 ? t('today.inbox-empty') : null}
    >
      {actions.map((a) => (
        <Link
          key={a.id}
          href={`/project/${projectId}/actions`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background .1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>
              {a.title}
            </div>
          </div>
          <span className="lp-mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
            {humanAge(a.created_at)}
          </span>
        </Link>
      ))}
      {extra > 0 && (
        <Link
          href={`/project/${projectId}/actions`}
          style={{
            display: 'block',
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            fontFamily: 'var(--f-mono)',
          }}
        >
          {t('today.more-in-inbox', { count: extra })}
        </Link>
      )}
    </Panel>
  );
}

function Panel({
  label,
  icon,
  href,
  hrefLabel,
  empty,
  children,
  dataTour,
}: {
  label: string;
  icon: string;
  href: string;
  hrefLabel: string;
  empty: string | null;
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <section
      data-tour={dataTour}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-l)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.5)',
        }}
      >
        <Icon d={icon} size={13} stroke={1.4} style={{ color: 'var(--accent-ink)' }} />
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'var(--ink-2)',
          }}
        >
          {label}
        </h2>
        <div style={{ flex: 1 }} />
        <Link
          href={href}
          style={{
            fontSize: 11,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            fontFamily: 'var(--f-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {hrefLabel}
          <Icon d={I.arrow} size={10} stroke={1.4} />
        </Link>
      </header>
      <div style={{ padding: 8 }}>
        {empty ? (
          <div
            style={{
              padding: '14px 12px',
              fontSize: 12,
              color: 'var(--ink-4)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function SkeletonRow() {
  const t = useT();
  return (
    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
      <LoadingState label={t('today.loading-today')} />
    </div>
  );
}

type TFn = (key: MessageKey, vars?: TranslateVars) => string;

function greeting(t: TFn): string {
  const h = new Date().getHours();
  if (h < 5) return t('today.greeting-late');
  if (h < 12) return t('today.greeting-morning');
  if (h < 18) return t('today.greeting-afternoon');
  return t('today.greeting-evening');
}

function summarize(t: TFn, inbox: number, signals: number): string {
  const bits: string[] = [];
  if (inbox > 0) bits.push(t('today.pending-actions', { count: inbox }));
  if (signals > 0) bits.push(t('today.signals-to-review', { count: signals }));
  if (bits.length === 0) return t('today.nothing-pending');
  return bits.join(' · ');
}

function humanAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
