'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { addAuditEntry } from '@/lib/audit';
import Spinner from '@/components/ui/spinner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/v1/auth/login', { email, password });
      const { accessToken, user } = res.data;
      localStorage.setItem('gymdash_token', accessToken);
      localStorage.setItem('gymdash_user', JSON.stringify(user));
      addAuditEntry('LOGIN', user.email);
      router.push('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo + Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <Image
            src="/logo.png"
            alt="GymPass SN"
            width={96}
            height={96}
            style={{ objectFit: 'contain', mixBlendMode: 'multiply', marginBottom: 20 }}
            priority
          />
          <div className="brand" style={{
            fontSize: 28, fontWeight: 900,
            color: 'var(--fg)', letterSpacing: '-0.03em',
            lineHeight: 1, marginBottom: 6,
          }}>
            GymDash
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg3)',
          }}>
            Administration
          </div>
        </div>

        {/* Card form */}
        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="login-email" className="section-label">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                className="input-base"
                placeholder="admin@gympass.sn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="login-password" className="section-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="input-base"
                  style={{ paddingRight: '46px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPwd}
                  onClick={() => setShowPwd((v) => !v)}
                  className="btn-icon"
                  style={{
                    position: 'absolute', right: 6,
                    top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34,
                    border: 'none', background: 'transparent',
                  }}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="banner-error" role="alert">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ marginTop: 4 }}
            >
              {loading && <Spinner size="sm" label="Connexion en cours" />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
