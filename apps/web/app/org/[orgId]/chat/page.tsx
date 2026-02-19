'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';

export default function ChatPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = (session?.user as any)?.id;
  const [status, setStatus] = useState<'loading' | 'no-gateway' | 'deploying' | 'redirecting'>('loading');

  useEffect(() => {
    if (!userId || !currentOrgId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const orgFetch = createOrgFetch(currentOrgId, userId);

    const checkGateway = async () => {
      try {
        // Get members and find self
        const res = await orgFetch<{ data: any[] }>('/members');
        const me = res.data.find((m: any) => m.user_id === userId);
        if (!me) {
          setStatus('no-gateway');
          return;
        }

        if (me.gateway_status === 'running' && me.gateway_port) {
          if (intervalId) clearInterval(intervalId);
          setStatus('redirecting');
          const hostname = window.location.hostname;
          window.location.href = `http://${hostname}:${me.gateway_port}/?token=${me.gateway_token}`;
        } else if (me.gateway_status === 'deploying') {
          setStatus('deploying');
        } else {
          setStatus('no-gateway');
        }
      } catch {
        setStatus('no-gateway');
      }
    };

    checkGateway();
    intervalId = setInterval(checkGateway, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, currentOrgId, userId]);

  if (status === 'loading' || status === 'redirecting' || status === 'deploying') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 mx-auto mb-4 animate-spin"
            style={{
              borderColor: 'var(--border-primary)',
              borderTopColor: 'var(--accent)',
            }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {status === 'loading' && 'Checking your AI assistant...'}
            {status === 'deploying' && 'Your AI assistant is starting up...'}
            {status === 'redirecting' && 'Opening your AI assistant...'}
          </p>
          {status === 'deploying' && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              This may take a moment
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
        </div>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          AI Assistant Not Available
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Your AI assistant is not yet deployed. Contact your admin to get started.
        </p>
      </div>
    </div>
  );
}
