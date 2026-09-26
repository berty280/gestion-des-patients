import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { appointmentStatusLabel, formatTime, todayIso } from '../lib/format';
import type { Appointment, AppointmentStatus, Patient } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, Field, PageTitle, Spinner, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';
import { PatientPicker } from '../components/PatientPicker';

const STATUS_TONE: Record<AppointmentStatus, 'slate' | 'amber' | 'sky' | 'emerald' | 'rose'> = {
  PLANIFIE: 'slate',
  EN_ATTENTE: 'amber',
  EN_COURS: 'sky',
  TERMINE: 'emerald',
  ANNULE: 'rose',
};

// Next status in the workflow, with a button label.
const NEXT: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  PLANIFIE: { to: 'EN_ATTENTE', label: 'Arrivé (file)' },
  EN_ATTENTE: { to: 'EN_COURS', label: 'En consultation' },
  EN_COURS: { to: 'TERMINE', label: 'Terminer' },
};

export function AppointmentsPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api<Appointment[]>(`/appointments?date=${date}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function setStatus(a: Appointment, status: AppointmentStatus) {
    try {
      await api(`/appointments/${a.id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Mise à jour impossible');
    }
  }

  async function remove(a: Appointment) {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    try {
      await api(`/appointments/${a.id}`, { method: 'DELETE' });
      toast.success('Rendez-vous supprimé.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle title="File d'attente & rendez-vous" />
        <Button onClick={() => setCreating(true)}>+ Rendez-vous</Button>
      </div>

      <div className="flex items-center gap-2">
        <Field type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="secondary" onClick={() => setDate(todayIso())}>
          Aujourd'hui
        </Button>
      </div>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((a) => {
              const next = NEXT[a.status];
              const active = a.status !== 'TERMINE' && a.status !== 'ANNULE';
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="w-14 text-sm font-semibold text-slate-700">
                    {formatTime(a.scheduled_at)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/patients/${a.patient_id}`}
                      className="font-medium text-slate-800 hover:underline"
                    >
                      {a.last_name.toUpperCase()} {a.first_name}
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {a.reason || 'Sans motif'}
                      {a.patient_phone ? ` · ${a.patient_phone}` : ''}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[a.status]}>{appointmentStatusLabel[a.status]}</Badge>
                  <div className="flex gap-1">
                    {next && (
                      <button
                        onClick={() => setStatus(a, next.to)}
                        className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        {next.label}
                      </button>
                    )}
                    {active && (
                      <button
                        onClick={() => setStatus(a, 'ANNULE')}
                        className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      onClick={() => remove(a)}
                      className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                    >
                      Suppr.
                    </button>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <EmptyState>Aucun rendez-vous ce jour.</EmptyState>}
          </ul>
        </Card>
      )}

      {creating && (
        <AppointmentModal
          date={date}
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

function AppointmentModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [inQueue, setInQueue] = useState(date === todayIso());
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!patient) {
      toast.error('Sélectionnez un patient.');
      return;
    }
    setBusy(true);
    try {
      // Build a local ISO datetime for the chosen date + time.
      const local = new Date(`${date}T${time}:00`);
      const off = local.getTimezoneOffset() * 60000;
      const scheduled_at = new Date(local.getTime() - off).toISOString();
      await api('/appointments', {
        method: 'POST',
        body: {
          patient_id: patient.id,
          scheduled_at,
          reason: reason.trim() || null,
          status: inQueue ? 'EN_ATTENTE' : 'PLANIFIE',
        },
      });
      toast.success('Rendez-vous ajouté.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nouveau rendez-vous" onClose={onClose}>
      <div className="space-y-3">
        <PatientPicker selected={patient} onSelect={setPatient} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} disabled />
          <Field label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Textarea label="Motif" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={inQueue} onChange={(e) => setInQueue(e.target.checked)} />
          Placer directement en file d'attente
        </label>
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
