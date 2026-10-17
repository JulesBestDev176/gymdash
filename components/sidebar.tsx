'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, CreditCard,
  Activity, ClipboardList, UserCheck, LogOut,
  Dumbbell, ListVideo, UserCircle,
} from 'lucide-react';

const NAV_MAIN = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/gyms',       label: 'Salles',        icon: Building2 },
  { href: '/adherents',  label: 'Adhérents',     icon: UserCheck },
  { href: '/users',      label: 'Équipe',        icon: Users },
  { href: '/payments',   label: 'Paiements',     icon: CreditCard },
];

const NAV_GYMBRO = [
  { href: '/gymbro/utilisateurs', label: 'Utilisateurs', icon: UserCircle },
  { href: '/gymbro/programmes',   label: 'Programmes',   icon: ListVideo },
  { href: '/gymbro/exercices',    label: 'Exercices',    icon: Dumbbell },
];

const NAV_SYS = [
  { href: '/monitoring', label: 'Monitoring',    icon: Activity },
  { href: '/audit',      label: 'Audit',         icon: ClipboardList },
];

export default function Sidebar() {
  const path = usePathname();

  function isActive(href: string) {
    return path === href || (href !== '/dashboard' && path.startsWith(href));
  }

  function logout() {
    if (!confirm('Voulez-vous vous déconnecter ?')) return;
    localStorage.removeItem('gymdash_token');
    localStorage.removeItem('gymdash_user');
    window.location.href = '/login';
  }

  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('gymdash_user') : null;
  const user = userRaw ? JSON.parse(userRaw) : null;
  const initials = user ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase() : 'SA';

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Image src="/logo.png" alt="GymBro" width={22} height={22} style={{ objectFit: 'contain' }} />
        </div>
        <div className="sidebar-brand-text">
          <span className="brand">GymDash</span>
          <span className="sidebar-tag">SUPER ADMIN</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="section-label sidebar-nav-label">Navigation</span>
        {NAV_MAIN.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item${isActive(href) ? ' active' : ''}`} aria-current={isActive(href) ? 'page' : undefined}>
            <Icon size={14} strokeWidth={isActive(href) ? 2.5 : 2} />
            {label}
          </Link>
        ))}

        <div className="divider sidebar-divider" />
        <span className="section-label sidebar-nav-label">GymBro</span>
        {NAV_GYMBRO.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item${isActive(href) ? ' active' : ''}`} aria-current={isActive(href) ? 'page' : undefined}>
            <Icon size={14} strokeWidth={isActive(href) ? 2.5 : 2} />
            {label}
          </Link>
        ))}

        <div className="divider sidebar-divider" />

        <span className="section-label sidebar-nav-label">Système</span>
        {NAV_SYS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item${isActive(href) ? ' active' : ''}`} aria-current={isActive(href) ? 'page' : undefined}>
            <Icon size={14} strokeWidth={isActive(href) ? 2.5 : 2} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User block */}
      <div className="sidebar-user">
        <div className="divider" style={{ marginBottom: '12px' }} />
        <div className="sidebar-user-row">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {user ? `${user.prenom} ${user.nom}` : 'Super Admin'}
            </span>
            <span className="sidebar-user-role">Administrateur</span>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Déconnexion">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
