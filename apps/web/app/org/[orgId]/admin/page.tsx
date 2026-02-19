'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { MemberTable } from '@/components/admin/member-table';
import type { OrgMember } from '@clawteam/shared';

export default function AdminMembersPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = (session?.user as any)?.id;
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId || !userId) return;
    const orgFetch = createOrgFetch(currentOrgId, userId);
    orgFetch<{ data: OrgMember[] }>('/members')
      .then((res) => setMembers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentOrgId, userId]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          Members
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        Members
      </h1>
      <MemberTable initialMembers={members} />
    </div>
  );
}
