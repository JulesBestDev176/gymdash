'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, CreditCard, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gyms', label: 'Salles', icon: Building2 },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/payments', label: 'Paiements', icon: CreditCard },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-[var(--card)] border-r border-[var(--card-border)] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--card-border)]">
        <span className="text-xl font-black tracking-tight text-[var(--accent)]">GymDash</span>
        <span className="text-xs text-[var(--muted)] mt-0.5">admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4">
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--muted-bg)] transition-colors"
          onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
