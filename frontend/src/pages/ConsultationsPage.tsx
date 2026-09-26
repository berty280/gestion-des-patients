import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Consultation, Patient } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui';
import { Modal } from '../components/Modal';
import { PatientPicker } from '../components/PatientPicker';
import { ConsultationFormModal } from './ConsultationFormModal';
import { ConsultationView } from './ConsultationView';

export function ConsultationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Patient | null>(null);
  const [view, setView] = useState<Consultation | null>(null);

  function load() {
    setLoading(true);
    api<Consultation[]>('/consultations')
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle title="Consultations" subtitle="Les 100 dernières consultations" />
        <Button onClick={() => setPicking(true)}>+ Consultation</Button>
      </div>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setView(c)}
                    className="text-left font-medium text-slate-800 hover:underline"
                  >
                    {(c.last_name ?? '').toUpperCase()} {c.first_name}
                  </button>
                  <div className="truncate text-xs text-slate-500">
                    {c.motif || c.diagnosis || 'Consultation'} · {formatDateTime(c.created_at)}
                    {c.user_name ? ` · ${c.user_name}` : ''}
                  </div>
                </div>
                <Link
                  to={`/patients/${c.patient_id}`}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Dossier
                </Link>
              </li>
            ))}
            {rows.length === 0 && <EmptyState>Aucune consultation.</EmptyState>}
          </ul>
        </Card>
      )}

      {picking && (
        <Modal title="Choisir le patient" onClose={() => setPicking(false)}>
          <div className="space-y-3">
            <PatientPicker
              selected={target}
              onSelect={(p) => {
                setTarget(p);
                if (p) setPicking(false);
              }}
            />
            <p className="text-xs text-slate-400">
              Sélectionnez le patient pour ouvrir le formulaire de consultation.
            </p>
          </div>
        </Modal>
      )}

      {target && !picking && (
        <ConsultationFormModal
          patientId={target.id}
          patientName={`${target.first_name} ${target.last_name}`}
          type="GENERALE"
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      {view && (
        <ConsultationView
          consultation={view}
          patientName={`${view.first_name ?? ''} ${view.last_name ?? ''}`}
          onClose={() => setView(null)}
        />
      )}
    </div>
  );
}
