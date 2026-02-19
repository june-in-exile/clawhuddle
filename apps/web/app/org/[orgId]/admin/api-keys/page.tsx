'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { ApiKeyForm } from '@/components/admin/api-key-form';

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = (session?.user as any)?.id;
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId || !userId) return;
    const orgFetch = createOrgFetch(currentOrgId, userId);
    orgFetch<{ data: any[] }>('/api-keys')
      .then((res) => setKeys(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentOrgId, userId]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          API Keys
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        API Keys
      </h1>
      <ApiKeyForm initialKeys={keys} />
    </div>
  );
}
