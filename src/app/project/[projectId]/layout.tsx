'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useOpenActionCount } from '@/hooks/useOpenActionCount';
import { ChromeProvider, useChromeState } from '@/components/design/chrome-context';
import { TopBar, NavRail } from '@/components/design/chrome';
import { VisualStageTracker } from '@/components/design/VisualStageTracker';
import { LocaleProvider, useT } from '@/components/providers/LocaleProvider';
import { asLocale } from '@/lib/i18n/locales';

/**
 * Project layout — owns the PERSISTENT chrome (TopBar + VisualStageTracker + NavRail) plus the
 * project-loading gate.
 */

const FALLBACK_CRUMB_KEYS = {
  today: 'nav.home', actions: 'nav.inbox', knowledge: 'nav.knowledge',
  chat: 'nav.copilot', usage: 'nav.usage', financial: 'nav.financial', grants: 'nav.grants',
} as const;

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, loading, error, refresh } = useProject(projectId);
  const t = useT();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        {t('common.loading')}
      </div>
    );
  }

  if (error || !project) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ flexDirection: 'column', gap: 14 }}
      >
        <span className="text-slate-400 text-sm">{error || t('project-gate.not-found')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => refresh()}
            style={{
              padding: '6px 14px',
              background: 'var(--accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('common.retry')}
          </button>
          <Link
            href="/"
            style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'underline' }}
          >
            {t('project-gate.all-projects')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LocaleProvider initialLocale={asLocale(project.locale)}>
      <ChromeProvider>
        <ProjectChrome projectId={projectId} projectName={project.name} currentStep={project.current_step}>
          {children}
        </ProjectChrome>
      </ChromeProvider>
    </LocaleProvider>
  );
}

function ProjectChrome({
  projectId,
  projectName,
  currentStep = 1,
  children,
}: {
  projectId: string;
  projectName: string;
  currentStep?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  const seg = pathname.split('/')[3] ?? ''; // /project/<id>/<seg>
  const { count: inboxBadge } = useOpenActionCount(projectId);
  const chrome = useChromeState();
  const t = useT();

  const fallbackKey = FALLBACK_CRUMB_KEYS[seg as keyof typeof FALLBACK_CRUMB_KEYS];
  const breadcrumb =
    chrome.breadcrumb ?? [t('fin.breadcrumb-project'), fallbackKey ? t(fallbackKey) : projectName ?? ''];

  return (
    <div className="lp-frame">
      <TopBar projectId={projectId} breadcrumb={breadcrumb} right={chrome.right} />
      <VisualStageTracker
        projectId={projectId}
        activeStageNumber={currentStep}
        passedChecksCount={4}
        totalChecksCount={9}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <NavRail projectId={projectId} inboxBadge={inboxBadge} chatStreaming={chrome.chatStreaming} />
        <div key={pathname} className="lp-rise" style={{ flex: 1, minWidth: 0, display: 'flex', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
