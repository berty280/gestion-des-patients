import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { fcfa, formatDate, invoiceStatusLabel } from '../lib/format';
import type { Invoice, InvoiceStatus, Patient } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui';
import { Modal } from '../components/Modal';
import { PatientPicker } from '../components/PatientPicker';
import { InvoiceFormModal } from './InvoiceFormModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';

const FILTERS: Array<{ value: '' | InvoiceStatus; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'IMPAYEE', label: 'Impayées' },
  { value: 'PARTIELLE', label: 'Partielles' },
  { value: 'PAYEE', label: 'Payées' },
];

export function InvoicesPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<'' | InvoiceStatus>('');
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Patient | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api<Invoice[]>(`/invoices${filter ? `?status=${filter}` : ''}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle title="Facturation" />
        <Button onClick={() => setPicking(true)}>+ Facture</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((inv) => (
              <li key={inv.id}>
                <button
                  onClick={() => setOpenId(inv.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800">
                      {inv.last_name.toUpperCase()} {inv.first_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {inv.code} · {formatDate(inv.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{fcfa(inv.total)}</div>
                    <Badge
                      tone={
                        inv.status === 'PAYEE'
                          ? 'emerald'
                          : inv.status === 'PARTIELLE'
                            ? 'amber'
                            : 'rose'
                      }
                    >
                      {invoiceStatusLabel[inv.status]}
                    </Badge>
                  </div>
                </button>
              </li>
            ))}
            {rows.length === 0 && <EmptyState>Aucune facture.</EmptyState>}
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
              Sélectionnez le patient pour créer sa facture.
            </p>
          </div>
        </Modal>
      )}

      {target && !picking && (
        <InvoiceFormModal
          patientId={target.id}
          patientName={`${target.first_name} ${target.last_name}`}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      {openId !== null && (
        <InvoiceDetailModal invoiceId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}
