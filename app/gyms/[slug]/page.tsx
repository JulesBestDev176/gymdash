'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa, Gym, GymStatut, User } from '@/lib/api';
import {
  ArrowLeft, UserPlus, CreditCard, Users, Building2,
  TrendingUp, MapPin, Settings, AlertCircle,
  ChevronDown, RefreshCw, X, Eye, EyeOff,
} from 'lucide-react';

/* ── types ────────────────────────────────────────────────── */
interface Payment {
  id: string;
  type: string;
  formule: string;
  montantFcfa: number;
  createdAt: string;
  member: { nom: string; prenom: string };
}

type TabKey = 'apercu' | 'equipe' | 'paiements';

/* ── constants ────────────────────────────────────────────── */
const STATUT_META: Record<GymStatut, { label: string; cls: string }> = {
  ACTIF:    { label: 'Actif',    cls: 'badge badge-success' },
  INACTIF:  { label: 'Inactif',  cls: 'badge badge-neutral' },
  SUSPENDU: { label: 'Suspendu', cls: 'badge badge-danger'  },
};

const ROLE_META: Record<string, { label: string; cls: string }> = {
  ADMIN:  { label: 'Admin',  cls: 'badge badge-accent' },
  GERANT: { label: 'Gérant', cls: 'badge badge-blue'   },
};

const TYPE_META: Record<string, string> = {
  ABONNEMENT:     'badge badge-accent',
  SEANCE_UNIQUE:  'badge badge-blue',
  INSCRIPTION:    'badge badge-warning',
  RECHARGE_CARTE: 'badge badge-purple',
};

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'apercu',    label: 'Aperçu',    icon: <Building2 size={13} /> },
  { key: 'equipe',    label: 'Équipe',    icon: <Users size={13} /> },
  { key: 'paiements', label: 'Paiements', icon: <CreditCard size={13} /> },
];

/* ── KPI card ─────────────────────────────────────────────── */
function KpiCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? 'card-accent' : 'card'} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="section-label">{label}</span>
      <div className={accent ? 'stat-value stat-value-accent' : 'stat-value'} style={{ fontSize: 22 }}>
        {value}
      </div>
      {sub && <span style={{ fontSize: 11, color: 'var(--fg3)', marginTop: -4 }}>{sub}</span>}
    </div>
  );
}

/* ── row ──────────────────────────────────────────────────── */
function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 0', gap: 16,
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--fg2)', flexShrink: 0 }}>{label}</span>
      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/* ── modal nouvel utilisateur ─────────────────────────────── */
const FORM_INIT = { prenom: '', nom: '', email: '', password: '', role: 'ADMIN' };

function NewUserModal({ gymId, onClose, onCreated }: {
  gymId: string;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const [form, setForm]     = useState(FORM_INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(k: keyof typeof FORM_INIT, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.post('/api/v1/users/admin-create', { ...form, gymId });
      onCreated(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouvel utilisateur"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--card)', border: '1px solid var(--border2)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'fadeUp 0.18s ease both',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              Nouvel utilisateur
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
              Créer un accès pour cette salle
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fg3)', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card2)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg3)'; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Prénom + Nom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="section-label" htmlFor="u-prenom">Prénom</label>
              <input
                ref={firstRef}
                id="u-prenom"
                required
                className="input-base"
                placeholder="Moussa"
                value={form.prenom}
                onChange={(e) => set('prenom', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="section-label" htmlFor="u-nom">Nom</label>
              <input
                id="u-nom"
                required
                className="input-base"
                placeholder="Diallo"
                value={form.nom}
                onChange={(e) => set('nom', e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="u-email">Email</label>
            <input
              id="u-email"
              type="email"
              required
              autoComplete="off"
              className="input-base"
              placeholder="moussa@gympass.sn"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>

          {/* Mot de passe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="u-pwd">Mot de passe temporaire</label>
            <div style={{ position: 'relative' }}>
              <input
                id="u-pwd"
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                className="input-base"
                placeholder="min. 6 caractères"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                aria-label={showPwd ? 'Masquer' : 'Afficher'}
                onClick={() => setShowPwd((v) => !v)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--fg3)', display: 'flex', padding: 4,
                }}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Rôle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="u-role">Rôle</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([['ADMIN', 'Admin', 'Propriétaire / accès total'], ['GERANT', 'Gérant', 'Réceptionniste / accès limité']] as const).map(([val, lbl, desc]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('role', val)}
                  style={{
                    padding: '10px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${form.role === val ? 'rgba(181,255,45,0.3)' : 'var(--border2)'}`,
                    background: form.role === val ? 'var(--accent-dim)' : 'var(--card2)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: form.role === val ? 'var(--accent)' : 'var(--fg)', marginBottom: 2 }}>
                    {lbl}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="banner-error" role="alert">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              {loading && <Spinner size="sm" label="Création en cours" />}
              {loading ? 'Création…' : 'Créer le compte'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function GymDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const [tab, setTab]         = useState<TabKey>('apercu');
  const [gym, setGym]         = useState<Gym | null>(null);
  const [users, setUsers]     = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [statutMenu, setStatutMenu] = useState(false);
  const [updatingStatut, setUpdatingStatut] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);

  const gymStatut = (g: Gym): GymStatut => g.statut ?? 'ACTIF';

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi.get('/api/v1/gym/all')
      .then((r) => {
        const found: Gym | undefined = r.data.find((g: Gym) => g.slug === slug);
        if (!found) { setError('Salle introuvable'); return; }
        setGym(found);
        return Promise.all([
          adminApi.get(`/api/v1/users?gymId=${found.id}`).catch(() => ({ data: [] })),
          adminApi.get(`/api/v1/payments?gymId=${found.id}`).catch(() => ({ data: [] })),
        ]);
      })
      .then((results) => {
        if (results) {
          setUsers(Array.isArray(results[0].data) ? results[0].data : []);
          setPayments(Array.isArray(results[1].data) ? results[1].data : []);
        }
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function changeStatut(s: GymStatut) {
    if (!gym) return;
    setStatutMenu(false);
    setUpdatingStatut(true);
    try {
      await adminApi.patch(`/api/v1/gym/${gym.id}/statut`, { statut: s });
      setGym((prev) => prev ? { ...prev, statut: s } : prev);
    } catch {
      // silently ignore — real error handling can be added
    } finally {
      setUpdatingStatut(false);
    }
  }

  /* ── loading ── */
  if (loading) {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <Spinner size="lg" style={{ color: 'var(--accent)' } as React.CSSProperties} />
        </div>
      </Shell>
    );
  }

  /* ── error / not found ── */
  if (error || !gym) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/gyms" className="btn-ghost" style={{ width: 'fit-content' }}>
            <ArrowLeft size={14} /> Retour
          </Link>
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            {error || 'Salle introuvable'}
            <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const statut = gymStatut(gym);
  const meta = STATUT_META[statut];

  return (
    <Shell>
      {showNewUser && gym && (
        <NewUserModal
          gymId={gym.id}
          onClose={() => setShowNewUser(false)}
          onCreated={(u) => { setUsers((prev) => [u, ...prev]); setShowNewUser(false); setTab('equipe'); }}
        />
      )}

      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ══ HEADER ══════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Link href="/gyms" className="btn-icon" aria-label="Retour aux salles" style={{ marginTop: 2 }}>
              <ArrowLeft size={15} />
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <h1 className="page-title">{gym.nom}</h1>
                <span className={meta.cls}>{meta.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg3)', fontSize: 12.5 }}>
                <MapPin size={12} strokeWidth={2} />
                {gym.ville}, {gym.pays}
                <span style={{ color: 'var(--border3)' }}>·</span>
                <span>
                  Créée le <span className="num">{new Date(gym.createdAt).toLocaleDateString('fr-FR')}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Statut dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn-ghost"
                onClick={() => setStatutMenu((v) => !v)}
                disabled={updatingStatut}
                style={{ gap: 6, fontSize: 12.5 }}
              >
                {updatingStatut
                  ? <Spinner size="sm" />
                  : <><Settings size={13} /> Statut <ChevronDown size={11} /></>
                }
              </button>
              {statutMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  borderRadius: 10, overflow: 'hidden', minWidth: 150,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                  {(['ACTIF', 'INACTIF', 'SUSPENDU'] as GymStatut[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatut(s)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 14px', background: s === statut ? 'var(--border)' : 'none',
                        border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                        color: s === statut ? 'var(--fg)' : 'var(--fg2)',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => { if (s !== statut) e.currentTarget.style.background = 'var(--card3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = s === statut ? 'var(--border)' : 'none'; }}
                    >
                      <span className={STATUT_META[s].cls} style={{ fontSize: 9.5 }}>{STATUT_META[s].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowNewUser(true)}>
              <UserPlus size={14} /> Nouvel utilisateur
            </button>
          </div>
        </div>

        {/* ══ KPI ROW ═════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Adhérents" value={<span className="num">{gym.nbAdherents ?? 0}</span>} />
          <KpiCard label="Revenu ce mois" value={fmtFcfa(gym.revenuMois ?? 0)} accent />
          <KpiCard label="Mensualité" value={fmtFcfa(gym.prixMensualite)} sub={`${gym.dureeMensualite} jours`} />
          <KpiCard label="Séance unique" value={fmtFcfa(gym.prixSeance)} />
        </div>

        {/* ══ TABS ════════════════════════════════════════ */}
        <div className="tab-bar" role="tablist">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`tab-item${tab === key ? ' active' : ''}`}
              style={{ gap: 6 }}
            >
              {icon}{label}
              {key === 'equipe' && users.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 16, padding: '0 5px', borderRadius: 99,
                  fontSize: 10, fontWeight: 700,
                  background: tab === key ? 'rgba(181,255,45,0.15)' : 'var(--card3)',
                  color: tab === key ? 'var(--accent)' : 'var(--fg3)',
                }}>
                  {users.length}
                </span>
              )}
              {key === 'paiements' && payments.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 16, padding: '0 5px', borderRadius: 99,
                  fontSize: 10, fontWeight: 700,
                  background: tab === key ? 'rgba(181,255,45,0.15)' : 'var(--card3)',
                  color: tab === key ? 'var(--accent)' : 'var(--fg3)',
                }}>
                  {payments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ APERÇU ══════════════════════════════════════ */}
        {tab === 'apercu' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Identité */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Identité</div>
              <InfoRow label="Nom"   value={gym.nom} />
              <InfoRow label="Slug"  value={gym.slug} />
              <InfoRow label="Ville" value={gym.ville} />
              <InfoRow label="Pays"  value={gym.pays} last />
            </div>

            {/* Tarification */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Tarification</div>
              <InfoRow label="Frais inscription" value={fmtFcfa(gym.fraisInscription)} />
              <InfoRow label="Prix mensualité"   value={fmtFcfa(gym.prixMensualite)} />
              <InfoRow label="Durée mensualité"  value={`${gym.dureeMensualite} jours`} />
              <InfoRow label="Prix séance"       value={fmtFcfa(gym.prixSeance)} last />
            </div>

            {/* Configuration */}
            <div className="card" style={{ padding: '18px 20px', gridColumn: '1 / -1' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Configuration</div>
              <InfoRow label="Anti double scan" value={`${gym.antiDoubleScanSec} secondes`} />
              <InfoRow label="Utilisateurs"     value={<span className="num">{gym.nbUsers ?? '—'}</span>} last />
            </div>
          </div>
        )}

        {/* ══ ÉQUIPE ══════════════════════════════════════ */}
        {tab === 'equipe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun utilisateur"
                subtitle="Créez le premier compte pour cette salle"
                action={
                  <button className="btn-primary" onClick={() => setShowNewUser(true)}>
                    <UserPlus size={14} /> Nouvel utilisateur
                  </button>
                }
              />
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.email}</td>
                        <td>
                          <span className={(ROLE_META[u.role] ?? { cls: 'badge badge-neutral' }).cls}>
                            {(ROLE_META[u.role] ?? { label: u.role }).label}
                          </span>
                        </td>
                        <td>
                          <span className={u.actif ? 'badge badge-success' : 'badge badge-danger'}>
                            {u.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ PAIEMENTS ═══════════════════════════════════ */}
        {tab === 'paiements' && (
          payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Aucun paiement"
              subtitle="Les paiements de cette salle apparaîtront ici"
            />
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-label">Historique</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    {fmtFcfa(payments.reduce((s, p) => s + p.montantFcfa, 0))}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--fg3)' }}>total</span>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Adhérent</th>
                    <th>Formule</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                    <th style={{ textAlign: 'right' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 50).map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.member.prenom} {p.member.nom}</td>
                      <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{p.formule}</td>
                      <td>
                        <span className={TYPE_META[p.type] ?? 'badge badge-neutral'} style={{ fontSize: 10 }}>
                          {p.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {fmtFcfa(p.montantFcfa)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--fg3)', fontSize: 12 }}>
                        {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

      </div>
    </Shell>
  );
}
