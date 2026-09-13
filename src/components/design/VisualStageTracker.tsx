'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CANONICAL_STAGES } from '@/lib/journey/canonical';
import { useT } from '@/components/providers/LocaleProvider';

interface VisualStageTrackerProps {
  projectId: string;
  activeStageNumber?: number;
  passedChecksCount?: number;
  totalChecksCount?: number;
}

export function VisualStageTracker({
  projectId,
  activeStageNumber = 1,
  passedChecksCount = 4,
  totalChecksCount = 9,
}: VisualStageTrackerProps) {
  const pathname = usePathname() || '';
  const t = useT();

  const currentStageIndex = Math.max(0, Math.min(6, activeStageNumber - 1));
  const progressPercent = Math.round((passedChecksCount / (totalChecksCount || 1)) * 100);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(11, 15, 23, 0.98) 100%)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        zIndex: 15,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* 7 Stage Stepper Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {CANONICAL_STAGES.map((stage, idx) => {
          const isPassed = idx < currentStageIndex;
          const isActive = idx === currentStageIndex;

          let badgeBg = 'rgba(51, 65, 85, 0.5)';
          let badgeColor = '#64748B';
          let borderStyle = '1px solid rgba(255, 255, 255, 0.05)';

          if (isPassed) {
            badgeBg = 'rgba(16, 185, 129, 0.15)';
            badgeColor = '#10B981';
            borderStyle = '1px solid rgba(16, 185, 129, 0.3)';
          } else if (isActive) {
            badgeBg = 'rgba(59, 130, 246, 0.2)';
            badgeColor = '#60A5FA';
            borderStyle = '1px solid rgba(59, 130, 246, 0.5)';
          }

          return (
            <React.Fragment key={stage.id}>
              {idx > 0 && (
                <div
                  style={{
                    width: 12,
                    height: 2,
                    background: isPassed ? '#10B981' : isActive ? 'rgba(59, 130, 246, 0.4)' : '#334155',
                    flexShrink: 0,
                  }}
                />
              )}
              <Link
                href={`/project/${projectId}/today`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: badgeBg,
                  border: borderStyle,
                  color: badgeColor,
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.25)' : 'none',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: isPassed ? '#10B981' : isActive ? '#3B82F6' : '#334155',
                    color: isPassed || isActive ? '#FFFFFF' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'var(--f-mono)',
                  }}
                >
                  {isPassed ? '✓' : stage.number}
                </span>
                <span>{stage.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
      </div>

      {/* Active Stage Live Metric Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          padding: '4px 10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Gate Progress
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F8FAFC' }}>
            {passedChecksCount} / {totalChecksCount} evidence checks ({progressPercent}%)
          </span>
        </div>
        <div style={{ width: 42, height: 6, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
              borderRadius: 3,
            }}
          />
        </div>
      </div>
    </div>
  );
}
