import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { specialtyLabel } from '../lib/roles';
import { examCategoryLabel, formatDateTime } from '../lib/format';
import type { Consultation } from '../lib/types';
import { Badge, Button, Spinner } from '../components/ui';
import { Modal } from '../components/Modal';
import { ExamOrderPrint, PrescriptionPrint } from '../components/Printables';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="py-1">
      <span className="text-xs text-slate-400">{label} : </span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

export function ConsultationView({
  consultation,
  patientName,
  onClose,
}: {
  consultation: Consultation;
  patientName: string;
  onClose: () => void;
}) {
  // Recharge la version complète (pathologies/prescriptions/examens) si absente.
  const [c, setC] = useState<Consultation>(consultation);
  const [loading, setLoading] = useState(!consultation.prescriptions);
  const [print, setPrint] = useState<null | 'ordonnance' | 'examens'>(null);

  useEffect(() => {
    if (!consultation.prescriptions) {
      api<Consultation>(`/consultations/${consultation.id}`)
        .then(setC)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [consultation.id, consultation.prescriptions]);

  const bp =
    c.bp_systolic || c.bp_diastolic ? `${c.bp_systolic ?? '?'}/${c.bp_diastolic ?? '?'} mmHg` : null;

  return (
    <Modal title={`Consultation — ${patientName}`} onClose={onClose} wide>
      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone={c.type === 'SPECIALISTE' ? 'sky' : 'blue'}>
              {c.type === 'SPECIALISTE' && c.specialty ? specialtyLabel[c.specialty] : 'Générale'}
            </Badge>
            <span>{formatDateTime(c.created_at)}</span>
            {c.user_name && <span>· {c.user_name}</span>}
          </div>

          <Row label="Motif" value={c.motif} />
          <Row label="Symptômes" value={c.symptoms} />

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="mb-1 text-xs font-medium text-slate-500">Signes vitaux</div>
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              <Row label="Poids" value={c.weight_kg ? `${c.weight_kg} kg` : null} />
              <Row label="Taille" value={c.height_cm ? `${c.height_cm} cm` : null} />
              <Row label="Température" value={c.temperature_c ? `${c.temperature_c} °C` : null} />
              <Row label="Tension" value={bp} />
              <Row label="Pouls" value={c.pulse ? `${c.pulse} bpm` : null} />
            </div>
          </div>

          {c.pathologies && c.pathologies.length > 0 && (
            <div className="py-1">
              <div className="mb-1 text-xs text-slate-400">Pathologies (CIM-10)</div>
              <div className="flex flex-wrap gap-1">
                {c.pathologies.map((p) => (
                  <Badge key={p.id} tone="slate">
                    {p.code ? `${p.code} · ` : ''}
                    {p.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Row label="Examen / constatations" value={c.findings} />
          <Row label="Actes / thérapies" value={c.procedures} />
          <Row label="Diagnostic" value={c.diagnosis} />

          {c.prescriptions && c.prescriptions.length > 0 && (
            <div className="py-1">
              <div className="mb-1 text-xs text-slate-400">Médicaments prescrits</div>
              <ul className="list-inside list-disc text-sm text-slate-800">
                {c.prescriptions.map((p) => (
                  <li key={p.id}>
                    {p.medication}
                    {p.dosage ? ` — ${p.dosage}` : ''}
                    {p.frequency ? `, ${p.frequency}` : ''}
                    {p.duration ? `, ${p.duration}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.exams && c.exams.length > 0 && (
            <div className="py-1">
              <div className="mb-1 text-xs text-slate-400">Examens prescrits</div>
              <ul className="list-inside list-disc text-sm text-slate-800">
                {c.exams.map((e) => (
                  <li key={e.id}>
                    <span className="text-slate-500">[{examCategoryLabel[e.category]}]</span> {e.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Row label="Résumé de fin de séance" value={c.summary} />
          <Row label="Notes" value={c.notes} />

          <div className="no-print flex flex-wrap justify-end gap-2 pt-3">
            {(c.prescriptions?.length ?? 0) > 0 && (
              <Button variant="secondary" onClick={() => setPrint('ordonnance')}>
                Imprimer l'ordonnance
              </Button>
            )}
            {(c.exams?.length ?? 0) > 0 && (
              <Button variant="secondary" onClick={() => setPrint('examens')}>
                Imprimer la demande d'examens
              </Button>
            )}
            <Button onClick={onClose}>Fermer</Button>
          </div>
        </div>
      )}

      {print === 'ordonnance' && (
        <PrescriptionPrint consultation={c} onClose={() => setPrint(null)} />
      )}
      {print === 'examens' && <ExamOrderPrint consultation={c} onClose={() => setPrint(null)} />}
    </Modal>
  );
}
