import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Consultation } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Field, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSaved: (c: Consultation) => void;
}

export function ConsultationFormModal({ patientId, patientName, onClose, onSaved }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    motif: '',
    symptoms: '',
    diagnosis: '',
    treatment: '',
    weight_kg: '',
    height_cm: '',
    temperature_c: '',
    bp_systolic: '',
    bp_diastolic: '',
    pulse: '',
    notes: '',
  });

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const body = {
        patient_id: patientId,
        motif: f.motif.trim() || null,
        symptoms: f.symptoms.trim() || null,
        diagnosis: f.diagnosis.trim() || null,
        treatment: f.treatment.trim() || null,
        weight_kg: numOrNull(f.weight_kg),
        height_cm: numOrNull(f.height_cm),
        temperature_c: numOrNull(f.temperature_c),
        bp_systolic: numOrNull(f.bp_systolic),
        bp_diastolic: numOrNull(f.bp_diastolic),
        pulse: numOrNull(f.pulse),
        notes: f.notes.trim() || null,
      };
      const saved = await api<Consultation>('/consultations', { method: 'POST', body });
      toast.success('Consultation enregistrée.');
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Nouvelle consultation — ${patientName}`} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Motif de consultation" value={f.motif} onChange={(e) => set('motif', e.target.value)} />
        <Textarea label="Symptômes" rows={2} value={f.symptoms} onChange={(e) => set('symptoms', e.target.value)} />

        <div>
          <p className="mb-1 text-sm font-medium text-slate-600">Signes vitaux</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Poids (kg)" inputMode="decimal" value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
            <Field label="Taille (cm)" inputMode="decimal" value={f.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
            <Field label="Temp. (°C)" inputMode="decimal" value={f.temperature_c} onChange={(e) => set('temperature_c', e.target.value)} />
            <Field label="TA systolique" inputMode="numeric" value={f.bp_systolic} onChange={(e) => set('bp_systolic', e.target.value)} />
            <Field label="TA diastolique" inputMode="numeric" value={f.bp_diastolic} onChange={(e) => set('bp_diastolic', e.target.value)} />
            <Field label="Pouls (bpm)" inputMode="numeric" value={f.pulse} onChange={(e) => set('pulse', e.target.value)} />
          </div>
        </div>

        <Textarea label="Diagnostic" rows={2} value={f.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />
        <Textarea label="Traitement / prescription" rows={3} value={f.treatment} onChange={(e) => set('treatment', e.target.value)} />
        <Textarea label="Notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? 'Enregistrement…' : 'Enregistrer la consultation'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
