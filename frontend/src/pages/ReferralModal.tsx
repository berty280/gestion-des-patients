import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { SPECIALTIES, specialtyLabel } from '../lib/roles';
import { WEEKDAYS } from '../lib/format';
import type { Referral, Specialist, Specialty } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Field, Select, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';

interface Props {
  patientId: number;
  patientName: string;
  consultationId?: number | null;
  onClose: () => void;
  onSaved: (r: Referral) => void;
}

export function ReferralModal({ patientId, patientName, consultationId, onClose, onSaved }: Props) {
  const toast = useToast();
  const [specialty, setSpecialty] = useState<Specialty>('GYNECOLOGIE');
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [toUserId, setToUserId] = useState<number | ''>('');
  const [indications, setIndications] = useState('');
  const [withAppt, setWithAppt] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Specialist[]>(`/specialists?specialty=${specialty}`)
      .then((list) => {
        setSpecialists(list);
        setToUserId(list.length === 1 ? list[0].id : '');
      })
      .catch(() => setSpecialists([]));
  }, [specialty]);

  const selected = specialists.find((s) => s.id === toUserId);
  const workdaysHint = selected
    ? selected.weekdays.map((w) => WEEKDAYS[w]).join(', ') || 'aucun jour défini'
    : null;

  async function save() {
    if (withAppt && !date) {
      toast.error('Choisissez une date de rendez-vous (ou décochez le rendez-vous).');
      return;
    }
    setBusy(true);
    try {
      let scheduled_at: string | null = null;
      if (withAppt && date) {
        const local = new Date(`${date}T${time}:00`);
        const off = local.getTimezoneOffset() * 60000;
        scheduled_at = new Date(local.getTime() - off).toISOString();
      }
      const body = {
        patient_id: patientId,
        consultation_id: consultationId ?? null,
        to_specialty: specialty,
        to_user_id: toUserId || null,
        indications: indications.trim() || null,
        scheduled_at,
        reason: `Consultation ${specialtyLabel[specialty]} (référée)`,
      };
      const saved = await api<Referral>('/referrals', { method: 'POST', body });
      toast.success('Référence enregistrée.');
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Référer ${patientName} à un spécialiste`} onClose={onClose}>
      <div className="space-y-3">
        <Select label="Spécialité" value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)}>
          {SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {specialtyLabel[s]}
            </option>
          ))}
        </Select>

        <Select
          label="Spécialiste"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">— Sans destinataire précis —</option>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {workdaysHint && (
          <p className="text-xs text-slate-500">Jours de prestation : {workdaysHint}</p>
        )}

        <Textarea
          label="Indications / recommandations"
          rows={3}
          value={indications}
          onChange={(e) => setIndications(e.target.value)}
          placeholder="Motif de la référence, éléments cliniques utiles au spécialiste…"
        />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={withAppt} onChange={(e) => setWithAppt(e.target.checked)} />
          Fixer un rendez-vous
        </label>
        {withAppt && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Field label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? 'Enregistrement…' : 'Référer'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
