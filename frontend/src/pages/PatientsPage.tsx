import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { ageLabel, sexLabel } from '../lib/format';
import type { Patient } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui';
import { PatientFormModal } from './PatientFormModal';

export function PatientsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api<Patient[]>(`/patients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle title="Patients" />
        <Button onClick={() => setCreating(true)}>+ Nouveau patient</Button>
      </div>

      <input
        placeholder="Rechercher (nom, téléphone, n° dossier)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/patients/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {p.first_name.charAt(0)}
                    {p.last_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">
                      {p.last_name.toUpperCase()} {p.first_name}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {p.code} · {p.sex ? sexLabel[p.sex] : '—'} · {ageLabel(p.birth_date)}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </div>
                  </div>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
            {rows.length === 0 && <EmptyState>Aucun patient.</EmptyState>}
          </ul>
        </Card>
      )}

      {creating && (
        <PatientFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}
