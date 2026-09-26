import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Patient } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Field, Select, Textarea } from '../components/ui';
import { Modal } from '../components/Modal';

interface Props {
  patient?: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export function PatientFormModal({ patient, onClose, onSaved }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    first_name: patient?.first_name ?? '',
    last_name: patient?.last_name ?? '',
    sex: patient?.sex ?? '',
    birth_date: patient?.birth_date ?? '',
    phone: patient?.phone ?? '',
    address: patient?.address ?? '',
    blood_group: patient?.blood_group ?? '',
    allergies: patient?.allergies ?? '',
    emergency_contact: patient?.emergency_contact ?? '',
    notes: patient?.notes ?? '',
  });

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!f.first_name.trim() || !f.last_name.trim()) {
      toast.error('Nom et prénom requis.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        sex: f.sex || null,
        birth_date: f.birth_date || null,
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        blood_group: f.blood_group || null,
        allergies: f.allergies.trim() || null,
        emergency_contact: f.emergency_contact.trim() || null,
        notes: f.notes.trim() || null,
      };
      const saved = patient
        ? await api<Patient>(`/patients/${patient.id}`, { method: 'PATCH', body })
        : await api<Patient>('/patients', { method: 'POST', body });
      toast.success('Patient enregistré.');
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={patient ? 'Modifier le patient' : 'Nouveau patient'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} />
          <Field
            label="Prénom"
            value={f.first_name}
            onChange={(e) => set('first_name', e.target.value)}
          />
          <Select label="Sexe" value={f.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">—</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
          <Field
            label="Date de naissance"
            type="date"
            value={f.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
          <Field
            label="Téléphone"
            inputMode="tel"
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Select
            label="Groupe sanguin"
            value={f.blood_group}
            onChange={(e) => set('blood_group', e.target.value)}
          >
            <option value="">—</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <Field label="Adresse" value={f.address} onChange={(e) => set('address', e.target.value)} />
        <Field
          label="Personne à contacter (urgence)"
          value={f.emergency_contact}
          onChange={(e) => set('emergency_contact', e.target.value)}
        />
        <Textarea
          label="Allergies"
          rows={2}
          value={f.allergies}
          onChange={(e) => set('allergies', e.target.value)}
        />
        <Textarea
          label="Antécédents / notes"
          rows={3}
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={busy} className="flex-1">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
