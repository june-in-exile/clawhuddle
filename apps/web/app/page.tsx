'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';

export default function Home() {
  const { data: session, status } = useSession();
  const { orgs, currentOrgId, loading } = useOrg();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || loading) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    if (orgs.length === 0) {
      router.replace('/onboarding');
      return;
    }

    const orgId = currentOrgId || orgs[0].id;
    const memberRole = orgs.find((o) => o.id === orgId)?.member_role;
    const isAdmin = memberRole === 'admin' || memberRole === 'owner';

    router.replace(`/org/${orgId}/${isAdmin ? 'admin' : 'chat'}`);
  }, [session, status, orgs, currentOrgId, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'var(--border-primary)',
          borderTopColor: 'var(--accent)',
        }}
      />
    </div>
  );
}
