'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, user } = res.data;
      localStorage.setItem('gymdash_token', accessToken);
      localStorage.setItem('gymdash_user', JSON.stringify(user));
      router.push('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>
            GymDash
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Administration GymPass SN
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors focus:ring-2"
              style={{
                background: 'var(--muted-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--foreground)',
              }}
              placeholder="admin@gympass.sn"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--muted-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'black' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
