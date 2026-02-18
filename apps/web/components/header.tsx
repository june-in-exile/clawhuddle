'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
      <Link href="/chat" className="text-lg font-semibold text-gray-900">
        ClawTeam
      </Link>
      <div className="flex items-center gap-3">
        {(session?.user as any)?.role === 'admin' && (
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        )}
        <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
