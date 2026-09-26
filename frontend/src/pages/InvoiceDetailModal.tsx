import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { roleAtLeast } from '../lib/roles';
import {
  fcfa,
  formatDateTime,
  invoiceStatusLabel,
  paymentMethodLabel,
} from '../lib/format';
import type { InvoiceDetail, PaymentMethod } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Field, Select, Spinner } from '../components/ui';
import { Modal } from '../components/Modal';

export function InvoiceDetailModal({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = roleAtLeast(user?.role, 'ADMIN');
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('ESPECES');
  const [busy, setBusy] = useState(false);

  function load() {
    api<InvoiceDetail>(`/invoices/${invoiceId}`)
      .then(setInv)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'));
  }

  useEffect(load, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = inv ? inv.total - inv.paid : 0;

  async function pay() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    setBusy(true);
    try {
      await api(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: { amount: Math.round(amt), method },
      });
      toast.success('Paiement enregistré.');
      setAmount('');
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Paiement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Supprimer définitivement cette facture ?')) return;
    try {
      await api(`/invoices/${invoiceId}`, { method: 'DELETE' });
      toast.success('Facture supprimée.');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  return (
    <Modal title={inv ? `Facture ${inv.code}` : 'Facture'} onClose={onClose} wide>
      {!inv ? (
        <Spinner label="Chargement…" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">
                {inv.last_name.toUpperCase()} {inv.first_name}
              </div>
              <div className="text-xs text-slate-500">{formatDateTime(inv.created_at)}</div>
            </div>
            <Badge
              tone={inv.status === 'PAYEE' ? 'emerald' : inv.status === 'PARTIELLE' ? 'amber' : 'rose'}
            >
              {invoiceStatusLabel[inv.status]}
            </Badge>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Libellé</th>
                  <th className="px-3 py-2 text-right font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">P.U.</th>
                  <th className="px-3 py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-slate-800">{it.label}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{it.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fcfa(it.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {fcfa(it.quantity * it.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold text-slate-900">{fcfa(inv.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payé</span>
              <span className="text-emerald-700">{fcfa(inv.paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reste à payer</span>
              <span className="font-semibold text-rose-600">{fcfa(remaining)}</span>
            </div>
          </div>

          {inv.payments.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">Paiements</div>
              <ul className="space-y-1 text-sm">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex justify-between text-slate-600">
                    <span>
                      {formatDateTime(p.created_at)} · {paymentMethodLabel[p.method]}
                    </span>
                    <span className="font-medium text-slate-800">{fcfa(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {remaining > 0 && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">Enregistrer un paiement</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <Field
                    label="Montant"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Select
                    label="Mode"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CARTE">Carte</option>
                    <option value="AUTRE">Autre</option>
                  </Select>
                </div>
                <Button onClick={pay} disabled={busy}>
                  {busy ? '…' : 'Encaisser'}
                </Button>
                <button
                  type="button"
                  onClick={() => setAmount(String(remaining))}
                  className="mb-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Tout ({fcfa(remaining)})
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-1">
            {isAdmin ? (
              <Button variant="danger" onClick={remove}>
                Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
