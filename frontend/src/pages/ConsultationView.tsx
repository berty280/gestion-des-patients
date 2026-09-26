import { formatDateTime } from '../lib/format';
import type { Consultation } from '../lib/types';
import { Button } from '../components/ui';
import { Modal } from '../components/Modal';

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
  consultation: c,
  patientName,
  onClose,
}: {
  consultation: Consultation;
  patientName: string;
  onClose: () => void;
}) {
  const bp =
    c.bp_systolic || c.bp_diastolic ? `${c.bp_systolic ?? '?'}/${c.bp_diastolic ?? '?'} mmHg` : null;

  return (
    <Modal title={`Consultation — ${patientName}`} onClose={onClose} wide>
      <div className="space-y-2">
        <div className="text-xs text-slate-500">
          {formatDateTime(c.created_at)}
          {c.user_name ? ` · ${c.user_name}` : ''}
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

        <Row label="Diagnostic" value={c.diagnosis} />
        {c.treatment && (
          <div className="py-1">
            <div className="text-xs text-slate-400">Traitement / prescription</div>
            <div className="whitespace-pre-wrap text-sm text-slate-800">{c.treatment}</div>
          </div>
        )}
        <Row label="Notes" value={c.notes} />

        <div className="no-print flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
