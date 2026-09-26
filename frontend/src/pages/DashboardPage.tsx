import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { roleAtLeast } from '../lib/roles';
import { fcfa } from '../lib/format';
import type { DashboardStats } from '../lib/types';
import { Card, PageTitle, Spinner } from '../components/ui';

function Stat({
  label,
  value,
  to,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  to?: string;
  tone?: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-700',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  };
  const inner = (
    <Card className="h-full">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading } = useFetch<DashboardStats>('/reports/dashboard');

  return (
    <div className="space-y-4">
      <PageTitle title="Tableau de bord" subtitle={`Bienvenue, ${user?.name ?? ''}`} />

      {loading || !data ? (
        <Spinner label="Chargement…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Patients enregistrés" value={data.patients_total} to="/patients" tone="blue" />
          <Stat label="En file d'attente" value={data.queue_waiting} to="/file" tone="amber" />
          <Stat label="Rendez-vous aujourd'hui" value={data.appointments_today} to="/file" />
          <Stat
            label="Consultations aujourd'hui"
            value={data.consultations_today}
            to={roleAtLeast(user?.role, 'SOIGNANT') ? '/consultations' : undefined}
          />
          <Stat
            label="Factures impayées"
            value={data.invoices_unpaid}
            to="/facturation"
            tone="rose"
          />
          <Stat
            label="Recettes du jour"
            value={fcfa(data.revenue_today)}
            to="/facturation"
            tone="emerald"
          />
        </div>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Accès rapides</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/patients"
            className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            + Nouveau patient
          </Link>
          <Link
            to="/file"
            className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100"
          >
            File d'attente du jour
          </Link>
          <Link
            to="/facturation"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
          >
            Facturation
          </Link>
        </div>
      </Card>
    </div>
  );
}
