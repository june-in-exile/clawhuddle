'use client';

import { signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ClawHuddleLogo } from '@/components/logo';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const isAccessDenied = error === 'AccessDenied';

  const title = isAccessDenied ? 'Access Denied' : 'Authentication Error';
  const description = isAccessDenied
    ? 'Your account is not allowed to access this workspace. Please contact your administrator or try a different account.'
    : 'An error occurred during sign in. Please try again.';

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 77, 77, 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-sm w-full space-y-8 p-8">
        {/* Brand */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: 'var(--accent-muted)',
              border: '1px solid rgba(255, 77, 77, 0.2)',
            }}
          >
            <ClawHuddleLogo size={28} />
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {description}
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => signOut({ redirectTo: '/login' })}
            className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150"
            style={{
              background: 'var(--accent)',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 77, 77, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Sign out & try again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
