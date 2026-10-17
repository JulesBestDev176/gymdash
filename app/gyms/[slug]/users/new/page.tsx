'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { adminApi, Gym } from '@/lib/api';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function NewUserPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [gymId, setGymId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', password: '', role: 'ADMIN',
  });

  useEffect(() => {
    adminApi.get('/api/v1/gym/all').then((r) => {
      const found = r.data.find((g: Gym) => g.slug === slug);
      if (found) setGymId(found.id);
    });
  }, [slug]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi.post('/api/v1/users/admin-create', { ...form, gymId });
      router.push(`/gyms/${slug}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-6 fade-up" style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/gyms/${slug}`} className="btn-icon">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">Nouvel utilisateur</h1>
            <p className="page-sub">Créer un accès pour cette salle</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-5">
          {/* Identité */}
          <div>
            <p className="section-label mb-3">Identité</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Prénom</label>
                <input
                  required
                  className="input-base"
                  value={form.prenom}
                  onChange={(e) => set('prenom', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Nom</label>
                <input
                  required
                  className="input-base"
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <p className="section-label mb-3">Accès</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Email</label>
                <input
                  type="email"
                  required
                  className="input-base"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Mot de passe temporaire</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input-base"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="section-label">Rôle</label>
                <select
                  className="input-base"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                >
                  <option value="ADMIN">ADMIN — Propriétaire</option>
                  <option value="GERANT">GERANT — Réceptionniste</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="banner-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading || !gymId}
              className="btn-primary flex-1"
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Création…' : 'Créer le compte'}
            </button>
            <Link href={`/gyms/${slug}`} className="btn-ghost">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
