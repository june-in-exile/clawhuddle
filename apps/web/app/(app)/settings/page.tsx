'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { TIER_INFO, TIER_LIMITS, type OrgTier, type OrgMember } from '@clawhuddle/shared';

const TIERS: OrgTier[] = ['free', 'pro'];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { currentOrg, currentOrgId } = useOrg();
  const { toast } = useToast();
  const userId = (session?.user as any)?.id;
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const orgFetch = useCallback(
    <T,>(path: string, options?: RequestInit) => {
      if (!currentOrgId || !userId) return Promise.reject(new Error('No org'));
      return createOrgFetch(currentOrgId, userId)<T>(path, options);
    },
    [currentOrgId, userId]
  );

  useEffect(() => {
    if (!currentOrgId || !userId) return;
    orgFetch<{ data: OrgMember[] }>('/members')
      .then((res) => setMemberCount(res.data.length))
      .catch(() => {});
  }, [currentOrgId, userId, orgFetch]);

  const tier = currentOrg?.tier || 'free';
  const limit = TIER_LIMITS[tier];
  const info = TIER_INFO[tier];
  const pct = memberCount !== null && limit !== Infinity ? Math.round((memberCount / limit) * 100) : 0;

  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        Plan & Billing
      </h1>

      {/* Current plan card */}
      <div
        className="rounded-xl p-5 mb-8"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Current Plan
            </span>
            <span
              className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent-text)' }}
            >
              {info.label}
            </span>
          </div>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {info.price}
          </span>
        </div>

        {memberCount !== null && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {memberCount} / {limit === Infinity ? '\u221e' : limit} members
              </span>
              {limit !== Infinity && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {pct}%
                </span>
              )}
            </div>
            {limit !== Infinity && (
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--accent)',
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-4">
        {TIERS.map((t) => {
          const ti = TIER_INFO[t];
          const tl = TIER_LIMITS[t];
          const isCurrent = t === tier;

          return (
            <div
              key={t}
              className="rounded-xl p-5 flex flex-col"
              style={{
                background: 'var(--bg-primary)',
                border: isCurrent
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {ti.label}
                </span>
                {t === 'pro' && (
                  <span style={{ fontSize: 12 }}>&#9733;</span>
                )}
              </div>
              <span
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {ti.price}
              </span>
              <span
                className="text-xs mb-4"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {tl === Infinity ? 'Unlimited' : `Up to ${tl}`} members
              </span>

              <div className="mt-auto">
                {isCurrent ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    &#10003; Current plan
                  </span>
                ) : t === 'enterprise' ? (
                  <button
                    onClick={() => window.open('mailto:sales@clawhuddle.com?subject=Enterprise%20Plan%20Inquiry', '_blank')}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  >
                    Contact Sales
                  </button>
                ) : (
                  <button
                    onClick={() => toast('Upgrade coming soon!', 'info')}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--text-inverse)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Need more quota?{' '}
        <a
          href="mailto:support@clawhuddle.com"
          className="underline transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          support@clawhuddle.com
        </a>
      </p>
    </div>
  );
}
