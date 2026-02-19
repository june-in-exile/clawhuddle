import { Header } from '@/components/header';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Header />
      {children}
    </div>
  );
}
