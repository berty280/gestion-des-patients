import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { fcfa } from '../lib/format';
import type { Invoice } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Field, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';

interface Line {
  label: string;
  quantity: string;
  unit_price: string;
}

interface Props {
  patientId: number;
  patientName: string;
  consultationId?: number | null;
  onClose: () => void;
  onSaved: (i: Invoice) => void;
}

export function InvoiceFormModal({ patientId, patientName, consultationId, onClose, onSaved }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([{ label: 'Consultation médicale', quantity: '1', unit_price: '' }]);

  function setLine(i: number, key: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { label: '', quantity: '1', unit_price: '' }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0,
  );

  async function save() {
    const items = lines
      .filter((l) => l.label.trim())
      .map((l) => ({
        label: l.label.trim(),
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.unit_price) || 0,
      }));
    if (items.length === 0) {
      toast.error('Ajoutez au moins une ligne avec un libellé.');
      return;
    }
    if (items.some((i) => i.quantity <= 0)) {
      toast.error('La quantité doit être positive.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        patient_id: patientId,
        consultation_id: consultationId ?? null,
        note: note.trim() || null,
        items,
      };
      const saved = await api<Invoice>('/invoices', { method: 'POST', body });
      toast.success('Facture créée.');
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Nouvelle facture — ${patientName}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={i === 0 ? 'Libellé' : undefined}
                  placeholder="Acte / médicament"
                  value={l.label}
                  onChange={(e) => setLine(i, 'label', e.target.value)}
                />
              </div>
              <div className="w-16">
                <Field
                  label={i === 0 ? 'Qté' : undefined}
                  inputMode="numeric"
                  value={l.quantity}
                  onChange={(e) => setLine(i, 'quantity', e.target.value)}
                />
              </div>
              <div className="w-28">
                <Field
                  label={i === 0 ? 'P.U. (FCFA)' : undefined}
                  inputMode="numeric"
                  value={l.unit_price}
                  onChange={(e) => setLine(i, 'unit_price', e.target.value)}
                />
              </div>
              <button
                onClick={() => removeLine(i)}
                className="mb-1 rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                aria-label="Retirer la ligne"
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
        >
          + Ajouter une ligne
        </button>

        <Textarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Total</span>
          <span className="text-lg font-bold text-slate-900">{fcfa(total)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? 'Création…' : 'Créer la facture'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
