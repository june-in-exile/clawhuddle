'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Organization, OrgTier } from '@clawhuddle/shared';
import { TIER_INFO } from '@clawhuddle/shared';

const SUPER_ADMIN_EMAIL = 'allenhsu.taiwan@gmail.com';

interface OrgWithCount extends Organization {
  member_count: number;
}

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const userId = (session?.user as any)?.id;
  const email = session?.user?.email;
  const [orgs, setOrgs] = useState<OrgWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    if (!userId || !isSuperAdmin) return;
    apiFetch<{ data: OrgWithCount[] }>('/api/super-admin/orgs', {
      headers: { 'x-user-id': userId },
    })
      .then((res) => setOrgs(res.data))
      .catch(() => toast('Failed to load organizations', 'error'))
      .finally(() => setLoading(false));
  }, [userId, isSuperAdmin]);

  const updateTier = async (orgId: string, tier: OrgTier) => {
    setUpdating(orgId);
    try {
      await apiFetch(`/api/super-admin/orgs/${orgId}/tier`, {
        method: 'PATCH',
        headers: { 'x-user-id': userId! },
        body: JSON.stringify({ tier }),
      });
      setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, tier } : o)));
      toast(`Tier updated to ${TIER_INFO[tier].label}`, 'success');
    } catch {
      toast('Failed to update tier', 'error');
    } finally {
      setUpdating(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Access denied.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
          Super Admin
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Super Admin
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
        Manage all organizations and tiers
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Organization', 'Slug', 'Members', 'Tier', 'Created'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.map((org, i) => (
              <tr
                key={org.id}
                className="transition-colors"
                style={{
                  borderBottom: i < orgs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {org.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {org.slug}
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {org.member_count}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={org.tier}
                    onChange={(e) => updateTier(org.id, e.target.value as OrgTier)}
                    disabled={updating === org.id}
                    className="text-xs font-medium px-2 py-1 rounded-md cursor-pointer disabled:opacity-50"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(org.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orgs.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No organizations yet.
          </p>
        )}
      </div>
    </div>
  );
}
