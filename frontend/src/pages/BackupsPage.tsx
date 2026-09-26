import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, getToken } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, PageTitle, Spinner } from '../components/ui';

interface BackupInfo {
  file: string;
  size: number;
  created_at: string;
}
interface BackupList {
  dir: string;
  enabled: boolean;
  items: BackupInfo[];
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BackupsPage() {
  const toast = useToast();
  const [data, setData] = useState<BackupList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<BackupList>('/backups')
      .then(setData)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(load, [load]);

  async function backupNow() {
    setBusy(true);
    try {
      await api('/backups', { method: 'POST' });
      toast.success('Sauvegarde créée.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Sauvegarde impossible');
    } finally {
      setBusy(false);
    }
  }

  // Téléchargement d'un fichier binaire avec le jeton d'authentification.
  async function download(name: string) {
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(name)}/download`, {
        headers: { authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Téléchargement impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Téléchargement impossible.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle title="Sauvegardes" subtitle="Copies de sécurité de la base de données" />
        <Button onClick={backupNow} disabled={busy}>
          {busy ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
        </Button>
      </div>

      {data && (
        <Card>
          <div className="text-sm text-slate-600">
            Sauvegarde automatique :{' '}
            {data.enabled ? (
              <span className="font-medium text-emerald-700">activée</span>
            ) : (
              <span className="font-medium text-rose-600">désactivée</span>
            )}
          </div>
          <div className="mt-1 break-all text-xs text-slate-400">Dossier : {data.dir}</div>
          <p className="mt-2 text-xs text-slate-500">
            Conseil : téléchargez régulièrement une sauvegarde sur une clé USB ou un disque
            externe, et conservez-la hors du poste serveur.
          </p>
        </Card>
      )}

      {loading ? (
        <Spinner label="Chargement…" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {data?.items.map((b) => (
              <li key={b.file} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{b.file}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(b.created_at)} · {humanSize(b.size)}
                  </div>
                </div>
                <button
                  onClick={() => download(b.file)}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                >
                  Télécharger
                </button>
              </li>
            ))}
            {(!data || data.items.length === 0) && (
              <EmptyState>Aucune sauvegarde pour l'instant.</EmptyState>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
