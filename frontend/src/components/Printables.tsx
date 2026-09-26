import { useEffect, type ReactNode } from 'react';
import { useClinicInfo, type ClinicInfo } from '../lib/useClinic';
import { fcfa, formatDate, formatDateTime, examCategoryLabel, paymentMethodLabel } from '../lib/format';
import type { Consultation, InvoiceDetail } from '../lib/types';

/**
 * Cadre commun : superpose une "feuille" imprimable. À l'impression, seul
 * l'élément .print-document est visible (voir index.css).
 */
function PrintFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-200/80 p-0 sm:p-6">
      {/* Barre d'actions (non imprimée) */}
      <div className="no-print sticky top-0 z-10 mb-4 flex items-center justify-between gap-2 bg-slate-800 px-4 py-2 text-white sm:rounded-lg">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            Imprimer
          </button>
          <button onClick={onClose} className="rounded bg-slate-600 px-3 py-1.5 text-sm hover:bg-slate-500">
            Fermer
          </button>
        </div>
      </div>

      {/* La feuille A4 */}
      <div className="print-document mx-auto max-w-[210mm] bg-white p-8 text-slate-900 shadow-lg sm:p-10">
        {children}
      </div>
    </div>
  );
}

function DocHeader({ clinic, docTitle }: { clinic: ClinicInfo; docTitle: string }) {
  return (
    <div className="mb-6 border-b-2 border-slate-800 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {clinic.clinicLogo && (
            <img src={clinic.clinicLogo} alt="Logo" className="h-16 w-16 object-contain" />
          )}
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">{clinic.clinicName}</div>
            {clinic.clinicAddress && (
              <div className="text-xs text-slate-500">{clinic.clinicAddress}</div>
            )}
            {clinic.clinicPhone && (
              <div className="text-xs text-slate-500">Tél. : {clinic.clinicPhone}</div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold uppercase text-slate-700">{docTitle}</div>
        </div>
      </div>
    </div>
  );
}

function PatientLine({ c, patientName }: { c: Consultation; patientName?: string }) {
  const name =
    (c.last_name || c.first_name)
      ? `${(c.last_name ?? '').toUpperCase()} ${c.first_name ?? ''}`.trim()
      : (patientName ?? '');
  return (
    <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm">
      <div>
        <span className="text-slate-500">Patient : </span>
        <span className="font-medium">{name}</span>
        {c.patient_code ? <span className="text-slate-500"> ({c.patient_code})</span> : null}
      </div>
      <div>
        <span className="text-slate-500">Date : </span>
        {formatDate(c.created_at)}
      </div>
    </div>
  );
}

function Signature({ who }: { who: string | null | undefined }) {
  return (
    <div className="mt-12 flex justify-end">
      <div className="text-center">
        <div className="mb-10 text-sm text-slate-500">{who ? `Dr ${who}` : 'Le médecin'}</div>
        <div className="w-56 border-t border-slate-400 pt-1 text-xs text-slate-500">
          Signature et cachet
        </div>
      </div>
    </div>
  );
}

/** Ordonnance médicale (médicaments prescrits). */
export function PrescriptionPrint({
  consultation,
  patientName,
  onClose,
}: {
  consultation: Consultation;
  patientName?: string;
  onClose: () => void;
}) {
  const clinic = useClinicInfo();
  const meds = consultation.prescriptions ?? [];
  return (
    <PrintFrame title="Ordonnance" onClose={onClose}>
      <DocHeader clinic={clinic} docTitle="Ordonnance médicale" />
      <PatientLine c={consultation} patientName={patientName} />

      <ol className="my-6 space-y-4">
        {meds.map((m, i) => (
          <li key={m.id} className="flex gap-2">
            <span className="font-semibold">{i + 1}.</span>
            <div>
              <div className="font-semibold">{m.medication}</div>
              <div className="text-sm text-slate-700">
                {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}
              </div>
              {m.instructions && <div className="text-sm italic text-slate-600">{m.instructions}</div>}
            </div>
          </li>
        ))}
        {meds.length === 0 && <li className="text-slate-500">Aucun médicament prescrit.</li>}
      </ol>

      <Signature who={consultation.user_name} />
    </PrintFrame>
  );
}

/** Demande d'examens (laboratoire / imagerie). */
export function ExamOrderPrint({
  consultation,
  patientName,
  onClose,
}: {
  consultation: Consultation;
  patientName?: string;
  onClose: () => void;
}) {
  const clinic = useClinicInfo();
  const exams = consultation.exams ?? [];
  return (
    <PrintFrame title="Demande d'examens" onClose={onClose}>
      <DocHeader clinic={clinic} docTitle="Demande d'examens" />
      <PatientLine c={consultation} patientName={patientName} />

      <ul className="my-6 space-y-2">
        {exams.map((e) => (
          <li key={e.id} className="flex items-baseline gap-2">
            <span className="w-24 shrink-0 text-xs font-medium uppercase text-slate-500">
              {examCategoryLabel[e.category]}
            </span>
            <span className="font-medium">{e.label}</span>
            {e.notes && <span className="text-sm text-slate-600">— {e.notes}</span>}
          </li>
        ))}
        {exams.length === 0 && <li className="text-slate-500">Aucun examen demandé.</li>}
      </ul>

      {consultation.diagnosis && (
        <div className="mt-4 text-sm">
          <span className="text-slate-500">Renseignements cliniques : </span>
          {consultation.diagnosis}
        </div>
      )}

      <Signature who={consultation.user_name} />
    </PrintFrame>
  );
}

/** Reçu de paiement (facture). */
export function ReceiptPrint({ invoice, onClose }: { invoice: InvoiceDetail; onClose: () => void }) {
  const clinic = useClinicInfo();
  const remaining = invoice.total - invoice.paid;
  return (
    <PrintFrame title="Reçu" onClose={onClose}>
      <DocHeader clinic={clinic} docTitle="Reçu de paiement" />

      <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm">
        <div>
          <span className="text-slate-500">Patient : </span>
          <span className="font-medium">
            {invoice.last_name.toUpperCase()} {invoice.first_name}
          </span>
        </div>
        <div>
          <span className="text-slate-500">N° : </span>
          <span className="font-medium">{invoice.code}</span>
          <span className="ml-3 text-slate-500">Date : </span>
          {formatDate(invoice.created_at)}
        </div>
      </div>

      <table className="my-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-300 text-left">
            <th className="py-2">Désignation</th>
            <th className="py-2 text-right">Qté</th>
            <th className="py-2 text-right">P.U.</th>
            <th className="py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-1.5">{it.label}</td>
              <td className="py-1.5 text-right">{it.quantity}</td>
              <td className="py-1.5 text-right">{fcfa(it.unit_price)}</td>
              <td className="py-1.5 text-right">{fcfa(it.quantity * it.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold">{fcfa(invoice.total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Payé</span>
          <span>{fcfa(invoice.paid)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-300 pt-1">
          <span className="text-slate-500">Reste à payer</span>
          <span className="font-semibold">{fcfa(remaining)}</span>
        </div>
      </div>

      {invoice.payments.length > 0 && (
        <div className="mt-6">
          <div className="mb-1 text-xs font-medium uppercase text-slate-500">Paiements</div>
          <ul className="space-y-0.5 text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {formatDateTime(p.created_at)} · {paymentMethodLabel[p.method]}
                </span>
                <span>{fcfa(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 text-center text-sm text-slate-500">Merci de votre visite.</div>
    </PrintFrame>
  );
}
