'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { adminApi, Gym } from '@/lib/api';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function NewUserPage() {
  const { slug } = useParams<{ slug: string }>();
  const [gymId, setGymId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  const [form, setForm] = useState({
    nom: '', prenom: '', telephone: '', password: '', role: 'ADMIN',
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
      const response = await adminApi.post('/api/v1/users/admin-create', { ...form, gymId });
      setCreated(response.data.whatsapp?.status === 'accepted'
        ? 'Compte créé. Identifiants transmis à Relayio pour envoi WhatsApp.'
        : 'Compte créé. L’envoi WhatsApp des identifiants n’a pas été confirmé.');
      setForm((previous) => ({ ...previous, password: '' }));
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

        {created ? <div className="card p-6 space-y-4">
          <p role="status">{created}</p>
          <Link href={`/gyms/${slug}`} className="btn-primary">Retour à la salle</Link>
        </div> : <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-5">
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
                <label className="section-label" htmlFor="phone">Téléphone WhatsApp</label>
                <input id="phone" type="tel" autoComplete="tel" required className="input-base"
                  placeholder="77 123 45 67" value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)} />
                <span style={{ color: 'var(--fg2)', fontSize: 12 }}>Indicatif facultatif</span>
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
        </form>}
      </div>
    </Shell>
  );
}
