import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { specialtyLabel } from '../lib/roles';
import type { Consultation, ConsultationType, ExamCategory, Pathology, Specialty } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Field, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';
import { PathologyPicker } from '../components/PathologyPicker';

interface PrescriptionRow {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
}
interface ExamRow {
  category: ExamCategory;
  label: string;
}

interface Props {
  patientId: number;
  patientName: string;
  type: ConsultationType;
  specialty?: Specialty | null; // spécialité (consultation spécialiste)
  referralId?: number | null;
  indications?: string | null; // indications du généraliste (affichées au spécialiste)
  onClose: () => void;
  onSaved: (c: Consultation) => void;
}

export function ConsultationFormModal({
  patientId,
  patientName,
  type,
  specialty,
  referralId,
  indications,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isSpecialist = type === 'SPECIALISTE';
  const pathologySpecialty = isSpecialist && specialty ? specialty : 'GENERAL';

  const [f, setF] = useState({
    motif: '',
    symptoms: '',
    weight_kg: '',
    height_cm: '',
    temperature_c: '',
    bp_systolic: '',
    bp_diastolic: '',
    pulse: '',
    findings: '',
    procedures: '',
    diagnosis: '',
    summary: '',
    notes: '',
  });
  const [pathologies, setPathologies] = useState<Pathology[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const body = {
        patient_id: patientId,
        type,
        specialty: isSpecialist ? specialty : null,
        referral_id: referralId ?? null,
        motif: f.motif.trim() || null,
        symptoms: f.symptoms.trim() || null,
        weight_kg: numOrNull(f.weight_kg),
        height_cm: numOrNull(f.height_cm),
        temperature_c: numOrNull(f.temperature_c),
        bp_systolic: numOrNull(f.bp_systolic),
        bp_diastolic: numOrNull(f.bp_diastolic),
        pulse: numOrNull(f.pulse),
        findings: f.findings.trim() || null,
        procedures: f.procedures.trim() || null,
        diagnosis: f.diagnosis.trim() || null,
        summary: f.summary.trim() || null,
        notes: f.notes.trim() || null,
        pathology_ids: pathologies.map((p) => p.id),
        prescriptions: prescriptions
          .filter((p) => p.medication.trim())
          .map((p) => ({
            medication: p.medication.trim(),
            dosage: p.dosage.trim() || null,
            frequency: p.frequency.trim() || null,
            duration: p.duration.trim() || null,
          })),
        exams: exams.filter((e) => e.label.trim()).map((e) => ({ category: e.category, label: e.label.trim() })),
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

  const title = isSpecialist
    ? `Consultation ${specialty ? specialtyLabel[specialty] : 'spécialisée'} — ${patientName}`
    : `Consultation générale — ${patientName}`;

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-3">
        {indications && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-amber-700">Indications du généraliste</div>
            <div className="whitespace-pre-wrap text-amber-900">{indications}</div>
          </div>
        )}

        <Field label="Motif de consultation" value={f.motif} onChange={(e) => set('motif', e.target.value)} />
        <Textarea label="Symptômes / anamnèse" rows={2} value={f.symptoms} onChange={(e) => set('symptoms', e.target.value)} />

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

        <PathologyPicker specialty={pathologySpecialty} selected={pathologies} onChange={setPathologies} />

        {isSpecialist && (
          <>
            <Textarea
              label={specialty === 'RADIOLOGIE' ? 'Examen / interprétation' : 'Examen clinique / constatations'}
              rows={3}
              value={f.findings}
              onChange={(e) => set('findings', e.target.value)}
            />
            <Textarea
              label={specialty === 'KINE' ? 'Thérapies exécutées' : 'Actes réalisés'}
              rows={2}
              value={f.procedures}
              onChange={(e) => set('procedures', e.target.value)}
            />
          </>
        )}

        <Textarea label="Diagnostic" rows={2} value={f.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />

        {/* Prescriptions de médicaments */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Médicaments prescrits</span>
            <button
              type="button"
              onClick={() => setPrescriptions((p) => [...p, { medication: '', dosage: '', frequency: '', duration: '' }])}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              + Médicament
            </button>
          </div>
          <div className="space-y-2">
            {prescriptions.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-4">
                <input placeholder="Médicament" value={p.medication}
                  onChange={(e) => setPrescriptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, medication: e.target.value } : x)))}
                  className="rounded border border-slate-300 px-2 py-1 text-sm" />
                <input placeholder="Posologie" value={p.dosage}
                  onChange={(e) => setPrescriptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, dosage: e.target.value } : x)))}
                  className="rounded border border-slate-300 px-2 py-1 text-sm" />
                <input placeholder="Fréquence" value={p.frequency}
                  onChange={(e) => setPrescriptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, frequency: e.target.value } : x)))}
                  className="rounded border border-slate-300 px-2 py-1 text-sm" />
                <div className="flex gap-1">
                  <input placeholder="Durée" value={p.duration}
                    onChange={(e) => setPrescriptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, duration: e.target.value } : x)))}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                  <button type="button" onClick={() => setPrescriptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded px-2 text-slate-400 hover:text-rose-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Examens prescrits */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Examens prescrits (labo / imagerie)</span>
            <button
              type="button"
              onClick={() => setExams((e) => [...e, { category: 'LABORATOIRE', label: '' }])}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              + Examen
            </button>
          </div>
          <div className="space-y-2">
            {exams.map((e, i) => (
              <div key={i} className="flex gap-2">
                <select value={e.category}
                  onChange={(ev) => setExams((prev) => prev.map((x, idx) => (idx === i ? { ...x, category: ev.target.value as ExamCategory } : x)))}
                  className="w-36 rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="LABORATOIRE">Laboratoire</option>
                  <option value="IMAGERIE">Imagerie</option>
                </select>
                <input placeholder="Examen (ex. NFS, échographie…)" value={e.label}
                  onChange={(ev) => setExams((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: ev.target.value } : x)))}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
                <button type="button" onClick={() => setExams((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded px-2 text-slate-400 hover:text-rose-600">✕</button>
              </div>
            ))}
          </div>
        </div>

        <Textarea label="Résumé de fin de séance" rows={3} value={f.summary} onChange={(e) => set('summary', e.target.value)} />

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
