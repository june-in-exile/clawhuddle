'use client';

import { SessionProvider } from 'next-auth/react';
import { OrgProvider } from '@/lib/org-context';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <OrgProvider>{children}</OrgProvider>
    </SessionProvider>
  );
}
