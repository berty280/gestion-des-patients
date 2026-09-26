import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { isMedecin } from '../lib/roles';
import { specialtyLabel } from '../lib/roles';
import {
  ageLabel,
  examCategoryLabel,
  fcfa,
  formatDate,
  formatDateTime,
  invoiceStatusLabel,
  referralStatusLabel,
  sexLabel,
} from '../lib/format';
import type { Consultation, Invoice, PatientDetail, PatientRecord } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui';
import { PatientFormModal } from './PatientFormModal';
import { ConsultationFormModal } from './ConsultationFormModal';
import { ConsultationView } from './ConsultationView';
import { ReferralModal } from './ReferralModal';
import { InvoiceFormModal } from './InvoiceFormModal';

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value || '—'}</div>
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const medecin = isMedecin(user?.role);
  const isGeneralist = user?.role === 'GENERALISTE' || user?.role === 'ADMIN';
  const isSpecialist = user?.role === 'SPECIALISTE';
  const isAdmin = user?.role === 'ADMIN';
  const canBill = user?.role === 'ACCUEIL' || user?.role === 'ADMIN';

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [newConsultType, setNewConsultType] = useState<null | 'GENERALE' | 'SPECIALISTE'>(null);
  const [referring, setReferring] = useState(false);
  const [newInvoice, setNewInvoice] = useState(false);
  const [viewConsult, setViewConsult] = useState<Consultation | null>(null);

  const loadPatient = useCallback(() => {
    api<PatientDetail>(`/patients/${id}`)
      .then(setPatient)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const loadRecord = useCallback(() => {
    if (!medecin) return;
    api<PatientRecord>(`/patients/${id}/record`)
      .then(setRecord)
      .catch(() => {});
  }, [id, medecin]);

  const loadInvoices = useCallback(() => {
    if (!canBill) return;
    api<Invoice[]>(`/invoices?patient_id=${id}`)
      .then(setInvoices)
      .catch(() => {});
  }, [id, canBill]);

  useEffect(() => {
    setLoading(true);
    loadPatient();
    loadRecord();
    loadInvoices();
  }, [loadPatient, loadRecord, loadInvoices]);

  async function remove() {
    if (!patient) return;
    if (!confirm(`Supprimer définitivement le dossier de ${patient.first_name} ${patient.last_name} ?`))
      return;
    try {
      await api(`/patients/${patient.id}`, { method: 'DELETE' });
      toast.success('Dossier supprimé.');
      navigate('/patients');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  if (loading) return <Spinner label="Chargement…" />;
  if (!patient) return <EmptyState>Patient introuvable.</EmptyState>;

  const fullName = `${patient.first_name} ${patient.last_name}`;
  const consultations = record?.consultations ?? [];

  return (
    <div className="space-y-4">
      <Link to="/patients" className="text-sm text-blue-600 hover:underline">
        ‹ Retour aux patients
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {patient.last_name.toUpperCase()} {patient.first_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Badge tone="blue">{patient.code}</Badge>
              <span>{patient.sex ? sexLabel[patient.sex] : '—'}</span>
              <span>· {ageLabel(patient.birth_date)}</span>
              {patient.blood_group && <Badge tone="rose">{patient.blood_group}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Éditer
            </Button>
            {isGeneralist && (
              <Button onClick={() => setNewConsultType('GENERALE')}>+ Consultation</Button>
            )}
            {isSpecialist && (
              <Button onClick={() => setNewConsultType('SPECIALISTE')}>+ Consultation</Button>
            )}
            {isGeneralist && (
              <Button variant="secondary" onClick={() => setReferring(true)}>
                Référer
              </Button>
            )}
            {canBill && (
              <Button variant="secondary" onClick={() => setNewInvoice(true)}>
                + Facture
              </Button>
            )}
            {isAdmin && (
              <Button variant="danger" onClick={remove}>
                Supprimer
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Info label="Date de naissance" value={formatDate(patient.birth_date)} />
          <Info label="Téléphone" value={patient.phone} />
          <Info label="Adresse" value={patient.address} />
          <Info label="Contact d'urgence" value={patient.emergency_contact} />
          <Info label="Allergies" value={patient.allergies} />
          <Info label="Dernière visite" value={formatDate(patient.last_visit)} />
        </div>
        {patient.notes && (
          <div className="mt-3">
            <div className="text-xs text-slate-400">Antécédents / notes</div>
            <div className="whitespace-pre-wrap text-sm text-slate-800">{patient.notes}</div>
          </div>
        )}
      </Card>

      {medecin && (
        <>
          <Card>
            <h2 className="mb-3 font-semibold text-slate-800">
              Historique des consultations{' '}
              <span className="text-sm font-normal text-slate-400">({consultations.length})</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {consultations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setViewConsult(c)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Badge tone={c.type === 'SPECIALISTE' ? 'sky' : 'blue'}>
                      {c.type === 'SPECIALISTE' && c.specialty ? specialtyLabel[c.specialty] : 'Générale'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {c.diagnosis || c.motif || 'Consultation'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(c.created_at)}
                        {c.user_name ? ` · ${c.user_name}` : ''}
                      </div>
                    </div>
                    <span className="text-slate-300">›</span>
                  </button>
                </li>
              ))}
              {consultations.length === 0 && <EmptyState>Aucune consultation enregistrée.</EmptyState>}
            </ul>
          </Card>

          {record && record.referrals.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold text-slate-800">Références vers les spécialistes</h2>
              <ul className="divide-y divide-slate-100">
                {record.referrals.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {specialtyLabel[r.to_specialty]}
                        {r.to_user_name ? ` · ${r.to_user_name}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        De {r.from_user_name ?? '—'} · {formatDate(r.created_at)}
                        {r.appointment_at ? ` · RDV ${formatDateTime(r.appointment_at)}` : ''}
                      </div>
                    </div>
                    <Badge
                      tone={
                        r.status === 'TERMINE' ? 'emerald' : r.status === 'ANNULE' ? 'rose' : 'amber'
                      }
                    >
                      {referralStatusLabel[r.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {record && (record.prescriptions.length > 0 || record.exams.length > 0) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <h2 className="mb-2 font-semibold text-slate-800">Médicaments prescrits</h2>
                <ul className="space-y-1 text-sm">
                  {record.prescriptions.map((p) => (
                    <li key={p.id} className="text-slate-700">
                      {p.medication}
                      {p.dosage ? ` — ${p.dosage}` : ''}
                      {p.frequency ? `, ${p.frequency}` : ''}
                      {p.duration ? `, ${p.duration}` : ''}
                    </li>
                  ))}
                  {record.prescriptions.length === 0 && <EmptyState>Aucun.</EmptyState>}
                </ul>
              </Card>
              <Card>
                <h2 className="mb-2 font-semibold text-slate-800">Examens prescrits</h2>
                <ul className="space-y-1 text-sm">
                  {record.exams.map((e) => (
                    <li key={e.id} className="text-slate-700">
                      <span className="text-slate-500">[{examCategoryLabel[e.category]}]</span> {e.label}
                    </li>
                  ))}
                  {record.exams.length === 0 && <EmptyState>Aucun.</EmptyState>}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}

      {canBill && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              Factures <span className="text-sm font-normal text-slate-400">({invoices.length})</span>
            </h2>
            <Button onClick={() => setNewInvoice(true)}>+ Facture</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{inv.code}</div>
                  <div className="text-xs text-slate-500">{formatDate(inv.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{fcfa(inv.total)}</div>
                  <Badge
                    tone={inv.status === 'PAYEE' ? 'emerald' : inv.status === 'PARTIELLE' ? 'amber' : 'rose'}
                  >
                    {invoiceStatusLabel[inv.status]}
                  </Badge>
                </div>
              </li>
            ))}
            {invoices.length === 0 && <EmptyState>Aucune facture.</EmptyState>}
          </ul>
        </Card>
      )}

      {editing && (
        <PatientFormModal
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            loadPatient();
          }}
        />
      )}
      {newConsultType && (
        <ConsultationFormModal
          patientId={patient.id}
          patientName={fullName}
          type={newConsultType}
          specialty={newConsultType === 'SPECIALISTE' ? user?.specialty ?? null : null}
          onClose={() => setNewConsultType(null)}
          onSaved={() => {
            setNewConsultType(null);
            loadRecord();
            loadPatient();
          }}
        />
      )}
      {referring && (
        <ReferralModal
          patientId={patient.id}
          patientName={fullName}
          onClose={() => setReferring(false)}
          onSaved={() => {
            setReferring(false);
            loadRecord();
          }}
        />
      )}
      {newInvoice && (
        <InvoiceFormModal
          patientId={patient.id}
          patientName={fullName}
          onClose={() => setNewInvoice(false)}
          onSaved={() => {
            setNewInvoice(false);
            loadInvoices();
          }}
        />
      )}
      {viewConsult && (
        <ConsultationView
          consultation={viewConsult}
          patientName={fullName}
          onClose={() => setViewConsult(null)}
        />
      )}
    </div>
  );
}
