import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { specialtyLabel } from '../lib/roles';
import { WEEKDAYS } from '../lib/format';
import type { Schedule, Specialist } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Field, PageTitle, Select, Spinner } from '../components/ui';

export function SchedulesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [userId, setUserId] = useState<number | null>(isAdmin ? null : (user?.id ?? null));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ weekday: '1', start_time: '08:00', end_time: '16:00' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api<Specialist[]>('/specialists')
        .then((list) => {
          setSpecialists(list);
          if (list.length && userId === null) setUserId(list[0].id);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<Schedule[]>(`/schedules?user_id=${userId}`)
      .then(setSchedules)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [userId, toast]);

  useEffect(load, [load]);

  async function add() {
    if (!userId) return;
    setBusy(true);
    try {
      await api('/schedules', {
        method: 'POST',
        body: {
          user_id: userId,
          weekday: Number(form.weekday),
          start_time: form.start_time,
          end_time: form.end_time,
        },
      });
      toast.success('Créneau ajouté.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Schedule) {
    try {
      await api(`/schedules/${s.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  const currentSpecialist = specialists.find((s) => s.id === userId);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Calendrier des prestations"
        subtitle="Jours et horaires de présence des spécialistes au centre"
      />

      {isAdmin && (
        <div className="w-72">
          <Select
            label="Spécialiste"
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
          >
            {specialists.length === 0 && <option value="">Aucun spécialiste</option>}
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {specialtyLabel[s.specialty]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!isAdmin && currentSpecialist === undefined && user?.specialty && (
        <p className="text-sm text-slate-500">{specialtyLabel[user.specialty]}</p>
      )}

      <Card>
        <div className="mb-2 text-sm font-medium text-slate-700">Ajouter un créneau</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Select label="Jour" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
              {WEEKDAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Field label="Début" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="w-28">
            <Field label="Fin" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <Button onClick={add} disabled={busy || !userId}>
            {busy ? '…' : 'Ajouter'}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-28 text-sm font-medium text-slate-800">{WEEKDAYS[s.weekday]}</span>
                <span className="flex-1 text-sm text-slate-600">
                  {s.start_time} – {s.end_time}
                </span>
                <button
                  onClick={() => remove(s)}
                  className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                >
                  Retirer
                </button>
              </li>
            ))}
            {schedules.length === 0 && <EmptyState>Aucun créneau défini.</EmptyState>}
          </ul>
        </Card>
      )}
    </div>
  );
}
