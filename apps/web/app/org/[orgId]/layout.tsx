'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const { switchOrg, currentOrgId } = useOrg();

  // Sync URL orgId with context
  useEffect(() => {
    if (orgId && orgId !== currentOrgId) {
      switchOrg(orgId);
    }
  }, [orgId, currentOrgId, switchOrg]);

  return <>{children}</>;
}
