import { useState } from 'react';
import { useFetch } from '../lib/useFetch';
import { fcfa, formatTime, paymentMethodLabel, todayIso } from '../lib/format';
import type { ActivityReport } from '../lib/types';
import { Card, EmptyState, Field, PageTitle, Spinner } from '../components/ui';

export function ReportsPage() {
  const [date, setDate] = useState(todayIso());
  const { data, loading } = useFetch<ActivityReport>(`/reports/activity?date=${date}`);

  return (
    <div className="space-y-4">
      <PageTitle title="Rapports d'activité" />

      <div className="flex items-center gap-2">
        <Field type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading || !data ? (
        <Spinner label="Chargement…" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <div className="text-2xl font-bold text-blue-700">{data.new_patients}</div>
              <div className="text-sm text-slate-500">Nouveaux patients</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-slate-900">{data.consultations_count}</div>
              <div className="text-sm text-slate-500">Consultations</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-emerald-600">{fcfa(data.revenue)}</div>
              <div className="text-sm text-slate-500">Recettes</div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-2 font-semibold text-slate-800">Consultations du jour</h2>
            <ul className="divide-y divide-slate-100">
              {data.consultations.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="w-14 text-sm text-slate-500">{formatTime(c.created_at)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {c.last_name.toUpperCase()} {c.first_name}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {c.motif || c.diagnosis || '—'}
                      {c.user_name ? ` · ${c.user_name}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {data.consultations.length === 0 && <EmptyState>Aucune consultation.</EmptyState>}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold text-slate-800">Encaissements du jour</h2>
            <ul className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="w-14 text-sm text-slate-500">{formatTime(p.created_at)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {p.last_name.toUpperCase()} {p.first_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.invoice_code} · {paymentMethodLabel[p.method]}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">{fcfa(p.amount)}</span>
                </li>
              ))}
              {data.payments.length === 0 && <EmptyState>Aucun encaissement.</EmptyState>}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
