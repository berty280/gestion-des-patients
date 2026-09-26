import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { clearClinicInfoCache, type ClinicInfo } from '../lib/useClinic';
import { useToast } from '../components/Toast';
import { Button, Card, Field, PageTitle, Spinner, Textarea } from '../components/ui';

// Taille max du logo côté client (~256 Ko une fois en base64).
const MAX_LOGO = 350_000;

export function SettingsPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<ClinicInfo>({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    clinicLogo: null,
  });

  useEffect(() => {
    api<ClinicInfo>('/settings')
      .then(setF)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [toast]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (dataUrl.length > MAX_LOGO) {
        toast.error('Logo trop volumineux (max ~256 Ko). Choisissez une image plus légère.');
        return;
      }
      setF((prev) => ({ ...prev, clinicLogo: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!f.clinicName.trim()) {
      toast.error('Le nom du centre est requis.');
      return;
    }
    setBusy(true);
    try {
      const saved = await api<ClinicInfo>('/settings', {
        method: 'PATCH',
        body: {
          clinicName: f.clinicName.trim(),
          clinicAddress: f.clinicAddress.trim(),
          clinicPhone: f.clinicPhone.trim(),
          clinicLogo: f.clinicLogo ?? '',
        },
      });
      setF(saved);
      clearClinicInfoCache();
      toast.success('Paramètres enregistrés.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div className="max-w-2xl space-y-4">
      <PageTitle
        title="Paramètres du centre"
        subtitle="Nom, adresse, téléphone et logo (affichés sur les documents imprimés)"
      />

      <Card className="space-y-4">
        <Field
          label="Nom du centre"
          value={f.clinicName}
          onChange={(e) => setF({ ...f, clinicName: e.target.value })}
        />
        <Textarea
          label="Adresse"
          rows={2}
          value={f.clinicAddress}
          onChange={(e) => setF({ ...f, clinicAddress: e.target.value })}
        />
        <Field
          label="Téléphone"
          value={f.clinicPhone}
          onChange={(e) => setF({ ...f, clinicPhone: e.target.value })}
        />

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">Logo</span>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {f.clinicLogo ? (
                <img src={f.clinicLogo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Aucun logo</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onLogoChange}
                className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:text-blue-700 hover:file:bg-blue-100"
              />
              {f.clinicLogo && (
                <button
                  type="button"
                  onClick={() => {
                    setF({ ...f, clinicLogo: null });
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Retirer le logo
                </button>
              )}
              <p className="text-xs text-slate-400">PNG, JPEG, SVG ou WebP — max ~256 Ko.</p>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <Button onClick={save} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Ces informations apparaissent en en-tête des ordonnances, demandes d'examens et reçus,
        ainsi que sur l'écran de connexion.
      </p>
    </div>
  );
}
