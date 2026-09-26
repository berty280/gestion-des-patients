import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { roleAtLeast, roleLabel } from '../lib/roles';
import type { DashboardStats, Role } from '../lib/types';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  min: Role;
  badge?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', min: 'ACCUEIL' },
  { to: '/file', label: "File d'attente", min: 'ACCUEIL', badge: true },
  { to: '/patients', label: 'Patients', min: 'ACCUEIL' },
  { to: '/consultations', label: 'Consultations', min: 'SOIGNANT' },
  { to: '/facturation', label: 'Facturation', min: 'ACCUEIL' },
  { to: '/rapports', label: 'Rapports', min: 'ADMIN' },
  { to: '/utilisateurs', label: 'Utilisateurs', min: 'ADMIN' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<DashboardStats>('/reports/dashboard')
        .then((s) => active && setQueueCount(s.queue_waiting))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const items = navItems.filter((i) => roleAtLeast(user?.role, i.min));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-blue-800 bg-blue-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Clinique</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-blue-100">
              {user?.name} · {user ? roleLabel[user.role] : ''}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-blue-800 px-3 py-1.5 text-sm hover:bg-blue-900"
            >
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-2 pb-1">
          <div className="flex gap-1">
            {items.map((item) => (
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
                {item.label}
                {item.badge && queueCount > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs text-white">
                    {queueCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
