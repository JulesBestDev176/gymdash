'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { ArrowLeft, AlertCircle } from 'lucide-react';

interface GymForm {
  nom: string;
  slug: string;
  ville: string;
  pays: string;
  fraisInscription: number;
  prixMensualite: number;
  prixSeance: number;
  dureeMensualite: number;
  antiDoubleScanSec: number;
}

export default function NewGymPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<GymForm>({
    nom: '',
    slug: '',
    ville: '',
    pays: 'Sénégal',
    fraisInscription: 5000,
    prixMensualite: 25000,
    prixSeance: 2500,
    dureeMensualite: 30,
    antiDoubleScanSec: 30,
  });

  function set(k: keyof GymForm, v: string | number) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'nom' && typeof v === 'string') {
        next.slug = v
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi.post('/api/v1/gym', form);
      router.push('/gyms');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-6 fade-up" style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/gyms" className="btn-icon">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">Nouvelle salle</h1>
            <p className="page-sub">Créer une salle GymPass</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-5">
          {/* Identité */}
          <div>
            <p className="section-label mb-3">Identité</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Nom de la salle</label>
                <input
                  required
                  className="input-base"
                  placeholder="Gym Central Dakar"
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="section-label">Slug (identifiant URL)</label>
                  <input
                    required
                    className="input-base"
                    placeholder="gymcentraldakar"
                    value={form.slug}
                    onChange={(e) => set('slug', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="section-label">Ville</label>
                  <input
                    required
                    className="input-base"
                    placeholder="Dakar"
                    value={form.ville}
                    onChange={(e) => set('ville', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Pays</label>
                <input
                  className="input-base"
                  value={form.pays}
                  onChange={(e) => set('pays', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tarifs */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <p className="section-label mb-3">Tarifs (FCFA)</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: 'fraisInscription' as keyof GymForm, label: "Frais d'inscription" },
                { k: 'prixMensualite' as keyof GymForm, label: 'Prix mensualité' },
                { k: 'prixSeance' as keyof GymForm, label: 'Prix séance unique' },
                { k: 'dureeMensualite' as keyof GymForm, label: 'Durée mensualité (jours)' },
              ].map(({ k, label }) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <label className="section-label">{label}</label>
                  <input
                    type="number"
                    min={0}
                    className="input-base num"
                    value={form[k] as number}
                    onChange={(e) => set(k, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Config */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <p className="section-label mb-3">Configuration</p>
            <div className="flex flex-col gap-1.5">
              <label className="section-label">Anti double scan (secondes)</label>
              <input
                type="number"
                min={0}
                className="input-base num"
                value={form.antiDoubleScanSec}
                onChange={(e) => set('antiDoubleScanSec', Number(e.target.value))}
              />
            </div>
          </div>

          {error && (
            <div className="banner-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading && <Spinner size="sm" />}
              {loading ? 'Création…' : 'Créer la salle'}
            </button>
            <Link href="/gyms" className="btn-ghost">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
