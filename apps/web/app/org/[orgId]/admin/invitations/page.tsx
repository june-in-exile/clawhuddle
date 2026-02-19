'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import type { Invitation } from '@clawteam/shared';

export default function InvitationsPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = (session?.user as any)?.id;
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const orgFetch = useCallback(
    <T,>(path: string, options?: RequestInit) => {
      if (!currentOrgId || !userId) return Promise.reject(new Error('No org'));
      return createOrgFetch(currentOrgId, userId)<T>(path, options);
    },
    [currentOrgId, userId]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await orgFetch<{ data: Invitation[] }>('/members/invitations');
      setInvitations(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [orgFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this invitation?')) return;
    try {
      await orgFetch(`/members/invitations/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert('Invitation link copied to clipboard!');
  };

  return (
    <div>
      <h1
        className="text-xl font-semibold tracking-tight mb-6"
        style={{ color: 'var(--text-primary)' }}
      >
        Pending Invitations
      </h1>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      ) : invitations.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No pending invitations. Invite members from the Members page.
          </p>
        </div>
      ) : (
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
                {['Email', 'Role', 'Invited By', 'Expires', 'Actions'].map((h) => (
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
              {invitations.map((inv, i) => (
                <tr
                  key={inv.id}
                  className="transition-colors"
                  style={{
                    borderBottom: i < invitations.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {inv.email}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {inv.role}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {inv.invited_by_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 space-x-3">
                    <button
                      onClick={() => copyLink(inv.token)}
                      className="text-xs font-medium transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => cancel(inv.id)}
                      className="text-xs font-medium transition-colors"
                      style={{ color: 'var(--red)' }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
