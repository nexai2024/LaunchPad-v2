/**
 * Design-system chrome — TopBar + NavRail.
 *
 * Modernized chrome with backdrop blur, polished active states,
 * refined iconography and alignment.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, I, BinocularsGlyph, RobotGlyph, RailTooltip, useRailHover, type IconKey } from './icons';
import { ShareButton } from '@/components/project/ShareButton';
import { DocsButton } from '@/components/project/DocsButton';
import { CreditsBadge } from '@/components/CreditsBadge';
import { LanguageSwitch } from '@/components/design/LanguageSwitch';
import { ThemeToggle } from '@/components/design/ThemeToggle';
import { Logomark } from '@/components/design/Logomark';
import { useKnowledgeCount } from '@/hooks/useKnowledgeCount';
import { useT } from '@/components/providers/LocaleProvider';
import type { MessageKey } from '@/lib/i18n/messages';

// =============================================================================
// TopBar
// =============================================================================

export interface TopBarProps {
  breadcrumb?: string[];
  right?: React.ReactNode;
  projectId?: string;
  theme?: 'paper' | 'ink';
}

export function TopBar({ breadcrumb, right, projectId }: TopBarProps) {
  const t = useT();
  return (
    <div
      style={{
        height: 42,
        flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        backdropFilter: 'var(--glass-backdrop)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <Link href="/" aria-label={t('nav.home-aria')} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <Logomark size={22} />
          <span
            style={{ fontFamily: 'var(--f-display)', fontSize: 13, fontWeight: 700, letterSpacing: '.03em', color: 'var(--ink)' }}
          >
            LAUNCHPAD
          </span>
        </Link>
        {breadcrumb && breadcrumb.length > 0 && (
          <span style={{ color: 'var(--ink-6)', margin: '0 2px' }}>·</span>
        )}
        {breadcrumb && breadcrumb.length > 0 && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {breadcrumb.map((b, i) => (
              <React.Fragment key={`${b}-${i}`}>
                {i > 0 && <Icon d={I.chevr} size={10} style={{ opacity: 0.5 }} />}
                <span style={{ color: i === breadcrumb.length - 1 ? 'var(--ink)' : 'var(--ink-4)', fontWeight: i === breadcrumb.length - 1 ? 500 : 400 }}>
                  {b}
                </span>
              </React.Fragment>
            ))}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-4)' }}>
        {projectId && <DocsButton projectId={projectId} />}
        {projectId && <ShareButton projectId={projectId} />}
        {right}
        <LanguageSwitch readOnly={!!projectId} />
        {projectId && (
          <span title={t('credits.chip-tooltip')}>
            <CreditsBadge projectId={projectId} />
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// NavRail
// =============================================================================

interface NavItem {
  id: string;
  iconKey: IconKey;
  icon?: React.ReactNode;
  labelKey: MessageKey;
  route: string;
  fuzzy?: boolean;
  tooltipKey?: MessageKey;
}

const PRIMARY_ITEMS: NavItem[] = [
  { id: 'dashboard', iconKey: 'home', labelKey: 'nav.home', route: 'today',
    tooltipKey: 'nav.home.tooltip' },
  { id: 'build', iconKey: 'bolt', labelKey: 'nav.build', route: 'build',
    tooltipKey: 'nav.build.tooltip' },
];

const BUILD_NAV_ENABLED = process.env.NEXT_PUBLIC_BUILD_ENABLED === '1';
const VISIBLE_PRIMARY_ITEMS = PRIMARY_ITEMS.filter(
  (it) => it.id !== 'build' || BUILD_NAV_ENABLED,
);

const CHANNEL_ITEMS: NavItem[] = [
  { id: 'inbox',     iconKey: 'tickets', icon: <BinocularsGlyph />, labelKey: 'nav.inbox',     route: 'actions',
    tooltipKey: 'nav.inbox.tooltip' },
  { id: 'knowledge', iconKey: 'book',    labelKey: 'nav.knowledge', route: 'knowledge',
    tooltipKey: 'nav.knowledge.tooltip' },
  { id: 'grants',    iconKey: 'globe',   labelKey: 'nav.grants',    route: 'grants',
    tooltipKey: 'nav.grants.tooltip' },
  { id: 'financial', iconKey: 'dollar',  labelKey: 'nav.financial', route: 'financial',
    tooltipKey: 'nav.financial.tooltip' },
  { id: 'chat',      iconKey: 'chat',    icon: <RobotGlyph />,      labelKey: 'nav.copilot',   route: 'chat',
    tooltipKey: 'nav.copilot.tooltip' },
];

export interface NavRailProps {
  projectId: string;
  current?: string;
  inboxBadge?: number;
  chatStreaming?: boolean;
}

export function NavRail({ projectId, current, inboxBadge, chatStreaming }: NavRailProps) {
  const [initials, setInitials] = React.useState('··');
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.email) return;
        const local = String(d.email).split('@')[0] ?? '';
        const parts = local.split(/[._-]+/).filter(Boolean);
        const out = parts.length > 1
          ? (parts[0][0] + parts[1][0])
          : local.slice(0, 2);
        setInitials((out || '··').toUpperCase());
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, []);

  const pathname = usePathname() || '';
  const t = useT();
  const { count: knowledgeCount } = useKnowledgeCount(projectId);

  function isActive(item: NavItem): boolean {
    if (current) return current === item.id;
    return pathname.includes(`/project/${projectId}/${item.route}`);
  }

  return (
    <div
      data-tour="nav-rail"
      style={{
        width: 56,
        flexShrink: 0,
        borderRight: '1px solid var(--line)',
        background: 'var(--paper-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: 4,
        zIndex: 10,
      }}
    >
      {VISIBLE_PRIMARY_ITEMS.map((it) => (
        <NavRailItem
          key={it.id}
          item={it}
          label={t(it.labelKey)}
          tooltip={it.tooltipKey ? t(it.tooltipKey) : undefined}
          projectId={projectId}
          active={isActive(it)}
        />
      ))}
      <div
        aria-hidden
        style={{
          width: 28,
          height: 1,
          background: 'var(--line)',
          margin: '6px 0',
          flexShrink: 0,
        }}
      />
      {CHANNEL_ITEMS.map((it) => (
        <NavRailItem
          key={it.id}
          item={it}
          label={t(it.labelKey)}
          tooltip={it.tooltipKey ? t(it.tooltipKey) : undefined}
          projectId={projectId}
          active={isActive(it)}
          badge={it.id === 'inbox' ? inboxBadge : it.id === 'knowledge' ? knowledgeCount : undefined}
          badgeTone={it.id === 'knowledge' ? 'count' : 'alert'}
          streaming={it.id === 'chat' ? chatStreaming : undefined}
        />
      ))}
      <div style={{ flex: 1, minHeight: 8 }} />
      <ThemeToggle />
      <Link
        href="/settings"
        title={t('nav.settings')}
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: 15,
          background: 'var(--ink)',
          color: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'var(--f-mono)',
          marginTop: 6,
          textDecoration: 'none',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-card)',
          transition: 'transform 0.15s ease',
        }}
      >
        {initials}
      </Link>
    </div>
  );
}

function NavRailItem({ item, label, tooltip, projectId, active, badge, badgeTone = 'alert', streaming }: { item: NavItem; label: string; tooltip?: string; projectId: string; active: boolean; badge?: number; badgeTone?: 'alert' | 'count'; streaming?: boolean }) {
  const isCount = badgeTone === 'count';
  const { hover, bind } = useRailHover();
  return (
    <Link
      href={`/project/${projectId}/${item.route}`}
      aria-label={tooltip ?? label}
      data-tour={`nav-${item.id}`}
      {...bind}
      style={{
        width: 42,
        height: 40,
        borderRadius: 'var(--r-m)',
        cursor: 'pointer',
        background: active ? 'var(--surface-solid)' : 'transparent',
        boxShadow: active ? 'var(--shadow-card), inset 0 0 0 1px var(--line-2)' : 'none',
        color: active ? 'var(--ink)' : 'var(--ink-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        transition: 'all .15s ease',
        position: 'relative',
      }}
    >
      {item.icon ?? <Icon d={I[item.iconKey]} size={17} stroke={1.35} />}
      {typeof badge === 'number' && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            minWidth: 15,
            height: 15,
            borderRadius: 8,
            background: isCount ? 'var(--paper-3)' : 'var(--clay)',
            color: isCount ? 'var(--ink-4)' : 'var(--on-accent)',
            border: isCount ? '1px solid var(--line)' : 'none',
            boxSizing: 'border-box',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--f-mono)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {streaming && (
        <span
          className="lp-dot lp-pulse"
          style={{
            position: 'absolute',
            top: 5,
            right: 6,
            width: 6,
            height: 6,
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent)',
          }}
        />
      )}
      <RailTooltip label={label} show={hover} />
    </Link>
  );
}
