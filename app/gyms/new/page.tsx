'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/shell';
import { adminApi } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewGymPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nom: '', slug: '', ville: '', pays: 'SN',
    fraisInscription: 5000, prixMensualite: 25000,
    dureeMensualite: 30, prixSeance: 2500,
  });

  function set(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toSlug(s: string) {
    return s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi.post('/gym', form);
      router.push('/gyms');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg text-sm outline-none';
  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' };

  return (
    <Shell>
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/gyms" className="p-2 rounded-lg transition-colors hover:bg-[var(--muted-bg)]">
            <ArrowLeft size={18} style={{ color: 'var(--muted)' }} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Nouvelle salle</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Créer une salle GymPass</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Nom de la salle</label>
              <input
                required
                className={inputCls}
                style={inputStyle}
                value={form.nom}
                onChange={(e) => { set('nom', e.target.value); set('slug', toSlug(e.target.value)); }}
                placeholder="Gym Central Dakar"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Slug (identifiant)</label>
              <input
                required
                className={inputCls}
                style={inputStyle}
                value={form.slug}
                onChange={(e) => set('slug', toSlug(e.target.value))}
                placeholder="gymcentraldakar"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Ville</label>
              <input
                required
                className={inputCls}
                style={inputStyle}
                value={form.ville}
                onChange={(e) => set('ville', e.target.value)}
                placeholder="Dakar"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Pays</label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.pays}
                onChange={(e) => set('pays', e.target.value)}
              />
            </div>
          </div>

          <hr style={{ borderColor: 'var(--card-border)' }} />

          <h3 className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>TARIFS</h3>

          <div className="grid grid-cols-2 gap-4">
            {[
              { k: 'fraisInscription', label: "Frais d'inscription (FCFA)" },
              { k: 'prixMensualite', label: 'Prix mensualité (FCFA)' },
              { k: 'prixSeance', label: 'Prix séance unique (FCFA)' },
              { k: 'dureeMensualite', label: 'Durée mensualité (jours)' },
            ].map(({ k, label }) => (
              <div key={k} className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>{label}</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  style={inputStyle}
                  value={form[k as keyof typeof form]}
                  onChange={(e) => set(k, Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'black' }}
          >
            {loading ? 'Création...' : 'Créer la salle'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
