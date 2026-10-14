'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import { adminApi, Gym } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

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
    adminApi.get('/gym/all').then((r) => {
      const found = r.data.find((g: Gym) => g.slug === slug);
      if (found) setGymId(found.id);
    });
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Créer user via l'endpoint users — nécessite un JWT admin de la salle
      // Pour gymdash on utilise un login temporaire ou un endpoint dédié
      await adminApi.post('/users/admin-create', { ...form, gymId });
      router.push(`/gyms/${slug}`);
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
      <div className="max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/gyms/${slug}`} className="p-2 rounded-lg hover:bg-[var(--muted-bg)] transition-colors">
            <ArrowLeft size={18} style={{ color: 'var(--muted)' }} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Nouvel utilisateur</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Créer un accès pour cette salle</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Prénom</label>
              <input required className={inputCls} style={inputStyle}
                value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Nom</label>
              <input required className={inputCls} style={inputStyle}
                value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Email</label>
            <input type="email" required className={inputCls} style={inputStyle}
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Mot de passe temporaire</label>
            <input type="password" required minLength={6} className={inputCls} style={inputStyle}
              value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Rôle</label>
            <select className={inputCls} style={inputStyle}
              value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="ADMIN">ADMIN (Propriétaire)</option>
              <option value="GERANT">GERANT (Réceptionniste)</option>
            </select>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !gymId}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'black' }}
          >
            {loading ? 'Création...' : 'Créer le compte'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
