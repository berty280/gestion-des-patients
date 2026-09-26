import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Pathology } from '../lib/types';
import { Badge } from './ui';

interface Props {
  specialty: string; // Specialty | 'GENERAL'
  selected: Pathology[];
  onChange: (list: Pathology[]) => void;
  label?: string;
}

/** Recherche + multi-sélection de pathologies CIM-10 pour une spécialité. */
export function PathologyPicker({ specialty, selected, onChange, label = 'Pathologies (CIM-10)' }: Props) {
  const [all, setAll] = useState<Pathology[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api<Pathology[]>(`/pathologies?specialty=${encodeURIComponent(specialty)}`)
      .then(setAll)
      .catch(() => setAll([]));
  }, [specialty]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = all.filter((p) => !selectedIds.has(p.id));
    if (!term) return list.slice(0, 40);
    return list
      .filter(
        (p) => p.label.toLowerCase().includes(term) || (p.code ?? '').toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [all, q, selectedIds]);

  function add(p: Pathology) {
    onChange([...selected, p]);
  }
  function remove(id: number) {
    onChange(selected.filter((p) => p.id !== id));
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => remove(p.id)}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 hover:bg-blue-200"
              title="Retirer"
            >
              {p.code ? `${p.code} · ` : ''}
              {p.label} ✕
            </button>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une pathologie (libellé ou code CIM-10)…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-100">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => add(p)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
          >
            {p.code && <Badge tone="slate">{p.code}</Badge>}
            <span className="text-slate-700">{p.label}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-center text-xs text-slate-400">
            {all.length === 0 ? 'Aucune pathologie dans le catalogue.' : 'Aucun résultat.'}
          </div>
        )}
      </div>
    </div>
  );
}
