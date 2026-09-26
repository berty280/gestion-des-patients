import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { SPECIALTIES, specialtyLabel } from '../lib/roles';
import type { Pathology } from '../lib/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, Field, PageTitle, Select, Spinner } from '../components/ui';

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'GENERAL', label: 'Médecine générale' },
  ...SPECIALTIES.map((s) => ({ value: s, label: specialtyLabel[s] })),
];

export function PathologiesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const defaultCat = user?.role === 'SPECIALISTE' && user.specialty ? user.specialty : 'GENERAL';

  const [category, setCategory] = useState<string>(defaultCat);
  const [rows, setRows] = useState<Pathology[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ code: '', label: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<Pathology[]>(`/pathologies?specialty=${encodeURIComponent(category)}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [category, toast]);

  useEffect(load, [load]);

  const filtered = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return r.label.toLowerCase().includes(t) || (r.code ?? '').toLowerCase().includes(t);
  });

  async function add() {
    if (!form.label.trim()) {
      toast.error('Libellé requis.');
      return;
    }
    setBusy(true);
    try {
      await api('/pathologies', {
        method: 'POST',
        body: { specialty: category, code: form.code.trim() || null, label: form.label.trim() },
      });
      toast.success('Pathologie ajoutée.');
      setForm({ code: '', label: '' });
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Pathology) {
    if (!confirm(`Supprimer « ${p.label} » ?`)) return;
    try {
      await api(`/pathologies/${p.id}`, { method: 'DELETE' });
      toast.success('Supprimée.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Catalogue des pathologies"
        subtitle="Nomenclature CIM-10 (OMS), par spécialité"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Select label="Spécialité" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Field label="Rechercher" placeholder="Libellé ou code CIM-10…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isAdmin && (
        <Card>
          <div className="mb-2 text-sm font-medium text-slate-700">
            Ajouter une pathologie ({CATEGORIES.find((c) => c.value === category)?.label})
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Field label="Code CIM-10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex-1">
              <Field label="Libellé" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <Button onClick={add} disabled={busy}>
              {busy ? '…' : 'Ajouter'}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                {p.code && <Badge tone="slate">{p.code}</Badge>}
                <span className="flex-1 text-sm text-slate-800">{p.label}</span>
                {isAdmin && (
                  <button
                    onClick={() => remove(p)}
                    className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                  >
                    Supprimer
                  </button>
                )}
              </li>
            ))}
            {filtered.length === 0 && <EmptyState>Aucune pathologie.</EmptyState>}
          </ul>
        </Card>
      )}
    </div>
  );
}
