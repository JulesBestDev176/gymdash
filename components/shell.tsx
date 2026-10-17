'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './sidebar';
import Spinner from './ui/spinner';

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('gymdash_token');
    if (!token && path !== '/login') {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [path, router]);

  if (!ready) {
    return (
      <div className="app-loading">
        <Spinner size="md" style={{ color: 'var(--accent)' } as React.CSSProperties} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
