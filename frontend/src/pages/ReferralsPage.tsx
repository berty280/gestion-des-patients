import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { specialtyLabel } from '../lib/roles';
import { formatDate, formatDateTime, referralStatusLabel } from '../lib/format';
import type { Patient, Referral } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui';
import { Modal } from '../components/Modal';
import { PatientPicker } from '../components/PatientPicker';
import { ReferralModal } from './ReferralModal';
import { ConsultationFormModal } from './ConsultationFormModal';

export function ReferralsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSpecialist = user?.role === 'SPECIALISTE';

  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Patient | null>(null);
  const [consultFor, setConsultFor] = useState<Referral | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const path = isSpecialist ? '/referrals?mine=1' : '/referrals';
    api<Referral[]>(path)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [isSpecialist, toast]);

  useEffect(load, [load]);

  async function cancel(r: Referral) {
    if (!confirm('Annuler cette référence ?')) return;
    try {
      await api(`/referrals/${r.id}`, { method: 'PATCH', body: { status: 'ANNULE' } });
      toast.success('Référence annulée.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle
          title={isSpecialist ? 'Mes références' : 'Références'}
          subtitle={
            isSpecialist
              ? 'Patients orientés vers vous par les généralistes'
              : 'Orientations vers les spécialistes'
          }
        />
        {!isSpecialist && <Button onClick={() => setPicking(true)}>+ Référer</Button>}
      </div>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/patients/${r.patient_id}`}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {(r.last_name ?? '').toUpperCase()} {r.first_name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {specialtyLabel[r.to_specialty]}
                    {isSpecialist ? ` · de ${r.from_user_name ?? '—'}` : r.to_user_name ? ` · ${r.to_user_name}` : ''}
                    {r.appointment_at ? ` · RDV ${formatDateTime(r.appointment_at)}` : ` · ${formatDate(r.created_at)}`}
                  </div>
                  {r.indications && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">{r.indications}</div>
                  )}
                </div>
                <Badge
                  tone={r.status === 'TERMINE' ? 'emerald' : r.status === 'ANNULE' ? 'rose' : 'amber'}
                >
                  {referralStatusLabel[r.status]}
                </Badge>
                <div className="flex gap-1">
                  {isSpecialist && r.status !== 'TERMINE' && r.status !== 'ANNULE' && (
                    <button
                      onClick={() => setConsultFor(r)}
                      className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      Consulter
                    </button>
                  )}
                  {!isSpecialist && r.status !== 'TERMINE' && r.status !== 'ANNULE' && (
                    <button
                      onClick={() => cancel(r)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <EmptyState>{isSpecialist ? 'Aucune référence.' : 'Aucune orientation.'}</EmptyState>
            )}
          </ul>
        </Card>
      )}

      {picking && (
        <Modal title="Choisir le patient à référer" onClose={() => setPicking(false)}>
          <div className="space-y-3">
            <PatientPicker
              selected={target}
              onSelect={(p) => {
                setTarget(p);
                if (p) setPicking(false);
              }}
            />
          </div>
        </Modal>
      )}

      {target && !picking && (
        <ReferralModal
          patientId={target.id}
          patientName={`${target.first_name} ${target.last_name}`}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      {consultFor && (
        <ConsultationFormModal
          patientId={consultFor.patient_id}
          patientName={`${consultFor.first_name ?? ''} ${consultFor.last_name ?? ''}`}
          type="SPECIALISTE"
          specialty={user?.specialty ?? consultFor.to_specialty}
          referralId={consultFor.id}
          indications={consultFor.indications}
          onClose={() => setConsultFor(null)}
          onSaved={() => {
            setConsultFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
