import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { ageLabel } from '../lib/format';
import type { Patient } from '../lib/types';
import { cx } from './ui';

interface Props {
  onSelect: (patient: Patient) => void;
  selected?: Patient | null;
  label?: string;
}

/** Search-as-you-type patient selector. */
export function PatientPicker({ onSelect, selected, label = 'Patient' }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = setTimeout(() => {
      api<Patient[]>(`/patients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        .then(setRows)
        .catch(() => {});
    }, 200);
    return () => clearTimeout(h);
  }, [q, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <span className="text-slate-800">
            {selected.last_name.toUpperCase()} {selected.first_name}{' '}
            <span className="text-slate-400">({selected.code})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null as unknown as Patient);
              setQ('');
              setOpen(true);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Changer
          </button>
        </div>
      ) : (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un patient…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      )}

      {open && !selected && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {rows.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
              className={cx('block w-full px-3 py-2 text-left text-sm hover:bg-slate-50')}
            >
              <span className="font-medium text-slate-800">
                {p.last_name.toUpperCase()} {p.first_name}
              </span>
              <span className="text-xs text-slate-400">
                {' '}
                · {p.code} · {ageLabel(p.birth_date)}
              </span>
            </button>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-3 text-center text-sm text-slate-400">Aucun patient trouvé.</div>
          )}
        </div>
      )}
    </div>
  );
}
