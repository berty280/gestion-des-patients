import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload, ApiError, openAuthed } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { examCategoryLabel, formatDateTime } from '../lib/format';
import type { Attachment, ExamOrder } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Field, Select, Spinner } from '../components/ui';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function PatientAttachments({
  patientId,
  exams = [],
  onChanged,
}: {
  patientId: number;
  exams?: ExamOrder[];
  onChanged?: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [examId, setExamId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<Attachment[]>(`/patients/${patientId}/attachments`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [patientId, toast]);

  useEffect(load, [load]);

  async function upload() {
    if (!file) {
      toast.error('Choisissez un fichier.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (label.trim()) form.append('label', label.trim());
      if (examId) form.append('exam_order_id', examId);
      await apiUpload(`/patients/${patientId}/attachments`, form);
      toast.success('Fichier ajouté.');
      setFile(null);
      setLabel('');
      setExamId('');
      if (fileRef.current) fileRef.current.value = '';
      load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Téléversement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function open(a: Attachment) {
    try {
      await openAuthed(`/attachments/${a.id}/download`);
    } catch {
      toast.error('Ouverture impossible.');
    }
  }

  async function remove(a: Attachment) {
    if (!confirm(`Supprimer « ${a.label || a.filename} » ?`)) return;
    try {
      await api(`/attachments/${a.id}`, { method: 'DELETE' });
      toast.success('Fichier supprimé.');
      load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-800">
        Résultats d'examens & documents{' '}
        <span className="text-sm font-normal text-slate-400">({rows.length})</span>
      </h2>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 p-3">
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">Fichier (PDF ou image)</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div className="w-44">
          <Field label="Description" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. NFS, Écho" />
        </div>
        {exams.length > 0 && (
          <div className="w-56">
            <Select label="Rattacher à un examen" value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">— Aucun —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  [{examCategoryLabel[ex.category]}] {ex.label}
                  {ex.status === 'REALISE' ? ' ✓' : ''}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button onClick={upload} disabled={busy || !file}>
          {busy ? 'Envoi…' : 'Téléverser'}
        </Button>
      </div>

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="text-lg">{a.mime === 'application/pdf' ? '📄' : '🖼️'}</span>
              <div className="min-w-0 flex-1">
                <button onClick={() => open(a)} className="truncate text-left font-medium text-blue-700 hover:underline">
                  {a.label || a.filename}
                </button>
                <div className="text-xs text-slate-500">
                  {a.filename} · {humanSize(a.size)} · {formatDateTime(a.created_at)}
                  {a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}
                </div>
              </div>
              <button
                onClick={() => open(a)}
                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                Ouvrir
              </button>
              {(user?.role === 'ADMIN' || a.uploaded_by === user?.id) && (
                <button
                  onClick={() => remove(a)}
                  className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                >
                  Suppr.
                </button>
              )}
            </li>
          ))}
          {rows.length === 0 && <EmptyState>Aucun document. Téléversez un résultat d'examen (PDF).</EmptyState>}
        </ul>
      )}
    </Card>
  );
}
