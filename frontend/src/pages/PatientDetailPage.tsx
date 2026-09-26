import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { roleAtLeast } from '../lib/roles';
import {
  ageLabel,
  fcfa,
  formatDate,
  formatDateTime,
  invoiceStatusLabel,
  sexLabel,
} from '../lib/format';
import type { Consultation, Invoice, PatientDetail } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui';
import { PatientFormModal } from './PatientFormModal';
import { ConsultationFormModal } from './ConsultationFormModal';
import { ConsultationView } from './ConsultationView';
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
  const isSoignant = roleAtLeast(user?.role, 'SOIGNANT');
  const isAdmin = roleAtLeast(user?.role, 'ADMIN');

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [newConsult, setNewConsult] = useState(false);
  const [newInvoice, setNewInvoice] = useState(false);
  const [viewConsult, setViewConsult] = useState<Consultation | null>(null);

  function loadPatient() {
    api<PatientDetail>(`/patients/${id}`)
      .then(setPatient)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }
  function loadConsultations() {
    if (!isSoignant) return;
    api<Consultation[]>(`/consultations?patient_id=${id}`)
      .then(setConsultations)
      .catch(() => {});
  }
  function loadInvoices() {
    api<Invoice[]>(`/invoices?patient_id=${id}`)
      .then(setInvoices)
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    loadPatient();
    loadConsultations();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Éditer
            </Button>
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

      {isSoignant && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              Consultations{' '}
              <span className="text-sm font-normal text-slate-400">({consultations.length})</span>
            </h2>
            <Button onClick={() => setNewConsult(true)}>+ Consultation</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {consultations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setViewConsult(c)}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">
                      {c.motif || c.diagnosis || 'Consultation'}
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
      )}

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
                  tone={
                    inv.status === 'PAYEE' ? 'emerald' : inv.status === 'PARTIELLE' ? 'amber' : 'rose'
                  }
                >
                  {invoiceStatusLabel[inv.status]}
                </Badge>
              </div>
            </li>
          ))}
          {invoices.length === 0 && <EmptyState>Aucune facture.</EmptyState>}
        </ul>
      </Card>

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
      {newConsult && (
        <ConsultationFormModal
          patientId={patient.id}
          patientName={fullName}
          onClose={() => setNewConsult(false)}
          onSaved={() => {
            setNewConsult(false);
            loadConsultations();
            loadPatient();
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
