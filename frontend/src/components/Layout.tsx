import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { isMedecin, roleLabel, specialtyLabel } from '../lib/roles';
import type { DashboardStats, User } from '../lib/types';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  show: (u: User) => boolean;
  badge?: 'queue' | 'referrals';
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', show: () => true },
  {
    to: '/file',
    label: "File d'attente",
    show: (u) => u.role === 'ACCUEIL' || u.role === 'GENERALISTE' || u.role === 'ADMIN',
    badge: 'queue',
  },
  { to: '/agenda', label: 'Mon agenda', show: (u) => u.role === 'SPECIALISTE' },
  {
    to: '/references',
    label: (undefined as unknown) as string, // remplacé plus bas
    show: (u) => isMedecin(u.role),
    badge: 'referrals',
  },
  { to: '/patients', label: 'Patients', show: () => true },
  {
    to: '/consultations',
    label: 'Consultations',
    show: (u) => u.role === 'GENERALISTE' || u.role === 'ADMIN',
  },
  {
    to: '/facturation',
    label: 'Facturation',
    show: (u) => u.role === 'ACCUEIL' || u.role === 'ADMIN',
  },
  { to: '/catalogue', label: 'Pathologies (CIM-10)', show: (u) => isMedecin(u.role) },
  {
    to: '/calendriers',
    label: 'Calendriers',
    show: (u) => u.role === 'SPECIALISTE' || u.role === 'ADMIN',
  },
  { to: '/rapports', label: 'Rapports', show: (u) => u.role === 'ADMIN' },
  { to: '/utilisateurs', label: 'Utilisateurs', show: (u) => u.role === 'ADMIN' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<DashboardStats>('/reports/dashboard')
        .then((s) => active && setStats(s))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!user) return null;

  const items = navItems.filter((i) => i.show(user));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const referralsLabel = user.role === 'SPECIALISTE' ? 'Mes références' : 'Références';

  function badgeCount(badge?: 'queue' | 'referrals'): number {
    if (!stats) return 0;
    if (badge === 'queue') return stats.queue_waiting;
    if (badge === 'referrals') return user!.role === 'SPECIALISTE' ? stats.my_referrals_pending : 0;
    return 0;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-blue-800 bg-blue-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Clinique</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-blue-100 sm:inline">
              {user.name} ·{' '}
              {user.role === 'SPECIALISTE' && user.specialty
                ? specialtyLabel[user.specialty]
                : roleLabel[user.role]}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-blue-800 px-3 py-1.5 text-sm hover:bg-blue-900"
            >
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-2 pb-1">
          <div className="flex gap-1">
            {items.map((item) => {
              const count = badgeCount(item.badge);
              const label = item.to === '/references' ? referralsLabel : item.label;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cx(
                      'relative whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition',
                      isActive ? 'bg-slate-50 text-blue-800' : 'text-blue-50 hover:bg-blue-600',
                    )
                  }
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs text-white">
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
