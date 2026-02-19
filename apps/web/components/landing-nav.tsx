'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ClawHuddleLogo } from './logo';

export function LandingNav() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated' && !!session;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          style={{ color: '#ff4d4d' }}
        >
          <ClawHuddleLogo size={20} />
          ClawHuddle
        </Link>
        <div className="flex items-center gap-6">
          <a
            href="#pricing"
            className="text-[13px] transition-colors hidden sm:block"
            style={{ color: '#5a6480' }}
          >
            Pricing
          </a>
          {isLoggedIn ? (
            <Link
              href="/home"
              className="text-[13px] font-semibold px-4 py-1.5 rounded-md transition-all"
              style={{
                color: '#fff',
                background: '#ff4d4d',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-[13px] transition-colors"
              style={{ color: '#8892b0' }}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
