'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { SkillTable } from '@/components/admin/skill-table';
import type { Skill } from '@clawteam/shared';

export default function SkillsPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = (session?.user as any)?.id;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId || !userId) return;
    const orgFetch = createOrgFetch(currentOrgId, userId);
    orgFetch<{ data: Skill[] }>('/skills')
      .then((res) => setSkills(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentOrgId, userId]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          Skills
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        Skills
      </h1>
      <SkillTable initialSkills={skills} />
    </div>
  );
}
