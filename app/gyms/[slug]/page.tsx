'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import StaffAccountActions from '@/components/staff-account-actions';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa, Gym, GymStatut, User, Member, MemberStatut } from '@/lib/api';
import {
  ArrowLeft, UserPlus, CreditCard, Users, Building2,
  TrendingUp, MapPin, Settings, AlertCircle,
  ChevronDown, RefreshCw, X, Eye, EyeOff,
  Search, ChevronLeft, ChevronRight,
  ShieldOff, ShieldCheck, Wallet, CalendarCheck, Filter,
} from 'lucide-react';

type PayMode = 'ESPECES' | 'WAVE' | 'ORANGE_MONEY';
const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'ESPECES',      label: 'Espèces' },
  { value: 'WAVE',         label: 'Wave' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
];
function currentMoisCouvert(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── types ────────────────────────────────────────────────── */
interface Payment {
  id: string;
  type: string;
  formule: string;
  montantFcfa: number;
  createdAt: string;
  member: { nom: string; prenom: string };
}

type TabKey = 'apercu' | 'adherents' | 'equipe' | 'paiements';

const PAGE_SIZE = 20;

const MEMBER_STATUT_META: Record<MemberStatut, { label: string; cls: string }> = {
  ACTIF:            { label: 'Actif',          cls: 'badge badge-success' },
  EXPIRE_DEMAIN:    { label: 'Expire demain',   cls: 'badge badge-warning' },
  EXPIRE:           { label: 'Expiré',          cls: 'badge badge-danger'  },
  CARTE_DESACTIVEE: { label: 'Carte bloquée',   cls: 'badge badge-neutral' },
};

const MEMBER_FILTER_TABS: { key: MemberStatut | ''; label: string }[] = [
  { key: '',                 label: 'Tous' },
  { key: 'ACTIF',            label: 'Actifs' },
  { key: 'EXPIRE_DEMAIN',    label: 'Expire demain' },
  { key: 'EXPIRE',           label: 'Expirés' },
  { key: 'CARTE_DESACTIVEE', label: 'Carte bloquée' },
];

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
  { key: 'adherents', label: 'Adhérents', icon: <Users size={13} /> },
  { key: 'equipe',    label: 'Équipe',    icon: <UserPlus size={13} /> },
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
const FORM_INIT = { prenom: '', nom: '', telephone: '', password: '', role: 'ADMIN' };

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="u-phone">Téléphone WhatsApp</label>
            <input id="u-phone" type="tel" autoComplete="tel" required className="input-base"
              placeholder="77 123 45 67" value={form.telephone}
              onChange={(e) => set('telephone', e.target.value)} />
            <span style={{ color: 'var(--fg2)', fontSize: 12 }}>Indicatif facultatif</span>
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

/* ── modal inscription adhérent ──────────────────────────── */
function NewMemberModal({ gymId, fraisInscription, onClose, onCreated }: {
  gymId: string; fraisInscription: number;
  onClose: () => void; onCreated: (m: Member) => void;
}) {
  const [form, setForm] = useState({ prenom: '', nom: '', telephone: '' });
  const [mode, setMode] = useState<PayMode>('ESPECES');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await adminApi.post('/api/v1/members', {
        ...form,
        paiement: { mode, reference: reference.trim() || undefined },
      });
      onCreated(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Erreur lors de la création');
    } finally { setLoading(false); }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeUp 0.18s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em' }}>Inscrire un adhérent</div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>Frais d'inscription uniquement — 1ère mensualité le mois suivant</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg3)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="section-label" htmlFor="nm-prenom">Prénom</label>
              <input ref={firstRef} id="nm-prenom" required className="input-base" placeholder="Moussa" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="section-label" htmlFor="nm-nom">Nom</label>
              <input id="nm-nom" required className="input-base" placeholder="Diallo" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="nm-tel">Téléphone</label>
            <input id="nm-tel" type="tel" required className="input-base" placeholder="77 123 45 67" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
            <span style={{ fontSize: 11, color: 'var(--fg3)' }}>+221 ajouté automatiquement si absent</span>
          </div>

          {/* Paiement */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section-label">Paiement inscription</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PAY_MODES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => { setMode(value); setReference(''); }}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, border: `1px solid ${mode === value ? 'rgba(181,255,45,0.3)' : 'var(--border2)'}`, background: mode === value ? 'var(--accent-dim)' : 'var(--card2)', color: mode === value ? 'var(--accent)' : 'var(--fg2)', transition: 'all 0.12s' }}>
                  {label}
                </button>
              ))}
            </div>
            {mode !== 'ESPECES' && (
              <input className="input-base" placeholder={`Référence ${mode === 'WAVE' ? 'Wave' : 'Orange Money'}`} value={reference} onChange={(e) => setReference(e.target.value)} />
            )}
          </div>

          {/* Total */}
          <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--fg2)', fontWeight: 600 }}>Total à encaisser</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmtFcfa(fraisInscription)}</span>
          </div>

          {error && <div className="banner-error" role="alert"><AlertCircle size={14} />{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? <><Spinner size="sm" label="Inscription…" /> Inscription…</> : <><Wallet size={14} /> Inscrire et encaisser</>}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── modal mensualité ─────────────────────────────────────── */
function PayMensualiteModal({ member, gymId, prixMensualite, onClose, onPaid }: {
  member: Member; gymId: string; prixMensualite: number;
  onClose: () => void; onPaid: () => void;
}) {
  const [moisCouvert, setMoisCouvert] = useState(currentMoisCouvert(1));
  const [mode, setMode] = useState<PayMode>('ESPECES');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await adminApi.post('/api/v1/payments', {
        memberId: member.id, type: 'ABONNEMENT',
        moisCouvert, mode, reference: reference.trim() || undefined,
      });
      onPaid();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible d\'enregistrer le paiement');
    } finally { setLoading(false); }
  }

  const [yr, mo] = moisCouvert.split('-').map(Number);
  const moLabel = new Date(yr, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeUp 0.18s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Mensualité</div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>{member.prenom} {member.nom} · {member.numeroCarte}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg3)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="section-label" htmlFor="pm-mois">Mois couvert</label>
            <input id="pm-mois" type="month" required className="input-base" value={moisCouvert}
              onChange={(e) => setMoisCouvert(e.target.value)} />
            <span style={{ fontSize: 11, color: 'var(--fg3)' }}>Couvre : {moLabel}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-label">Mode de paiement</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PAY_MODES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => { setMode(value); setReference(''); }}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, border: `1px solid ${mode === value ? 'rgba(181,255,45,0.3)' : 'var(--border2)'}`, background: mode === value ? 'var(--accent-dim)' : 'var(--card2)', color: mode === value ? 'var(--accent)' : 'var(--fg2)', transition: 'all 0.12s' }}>
                  {label}
                </button>
              ))}
            </div>
            {mode !== 'ESPECES' && (
              <input className="input-base" placeholder={`Référence ${mode === 'WAVE' ? 'Wave' : 'Orange Money'}`} value={reference} onChange={(e) => setReference(e.target.value)} />
            )}
          </div>

          <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--fg2)', fontWeight: 600 }}>Mensualité {moLabel}</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmtFcfa(prixMensualite)}</span>
          </div>

          {error && <div className="banner-error" role="alert"><AlertCircle size={14} />{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? <><Spinner size="sm" label="Enregistrement…" /> Enregistrement…</> : <><CalendarCheck size={14} /> Enregistrer</>}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
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
  const [users, setUsers]         = useState<User[]>([]);
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [members, setMembers]           = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage]     = useState(1);
  const [memberStatut, setMemberStatut] = useState<MemberStatut | ''>('');
  const [togglingCarteId, setTogglingCarteId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [statutMenu, setStatutMenu] = useState(false);
  const [updatingStatut, setUpdatingStatut] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [userNotice, setUserNotice] = useState('');
  const [showNewMember, setShowNewMember] = useState(false);
  const [newMemberNotice, setNewMemberNotice] = useState('');
  const [payingMensualiteFor, setPayingMensualiteFor] = useState<Member | null>(null);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDateDebut, setPaymentDateDebut] = useState('');
  const [paymentDateFin, setPaymentDateFin] = useState('');

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
          adminApi.get(`/api/v1/gym/${found.id}/users`).catch(() => ({ data: [] })),
          adminApi.get(`/api/v1/gym/${found.id}/payments`).catch(() => ({ data: [] })),
          adminApi.get(`/api/v1/gym/${found.id}/members`).catch(() => ({ data: [] })),
        ]);
      })
      .then((results) => {
        if (results) {
          setUsers(Array.isArray(results[0].data) ? results[0].data : []);
          setPayments(Array.isArray(results[1].data) ? results[1].data : []);
          setMembers(Array.isArray(results[2].data) ? results[2].data : []);
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

  async function toggleUser(u: User) {
    setTogglingUserId(u.id);
    try {
      await adminApi.patch(`/api/v1/gym/user/${u.id}/toggle`);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingUserId(null); }
  }

  async function toggleMemberCarte(m: Member) {
    if (!gym) return;
    setTogglingCarteId(m.id);
    try {
      await adminApi.patch(`/api/v1/gym/${gym.id}/members/${m.id}/carte/toggle`);
      setMembers((prev) => prev.map((x) =>
        x.id === m.id
          ? { ...x, carteActive: !x.carteActive, statut: !x.carteActive ? ('ACTIF' as MemberStatut) : ('CARTE_DESACTIVEE' as MemberStatut) }
          : x
      ));
    } catch { /* ignore */ }
    finally { setTogglingCarteId(null); }
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
          onCreated={(u) => {
            setUsers((prev) => [u, ...prev]); setShowNewUser(false); setTab(‘equipe’);
            setUserNotice(u.whatsapp?.status === ‘accepted’
              ? "Compte créé. Identifiants transmis à Relayio pour envoi WhatsApp."
              : "Compte créé. L’envoi WhatsApp des identifiants n’a pas été confirmé.");
          }}
        />
      )}
      {showNewMember && gym && (
        <NewMemberModal
          gymId={gym.id}
          fraisInscription={gym.fraisInscription}
          onClose={() => setShowNewMember(false)}
          onCreated={(m) => {
            setMembers((prev) => [{ ...m, statut: ‘SANS_ABONNEMENT’ as MemberStatut }, ...prev]);
            setShowNewMember(false);
            setNewMemberNotice(`${m.prenom} ${m.nom} inscrit(e). Première mensualité à encaisser le mois suivant.`);
            setTimeout(() => setNewMemberNotice(‘’), 6000);
          }}
        />
      )}
      {payingMensualiteFor && gym && (
        <PayMensualiteModal
          member={payingMensualiteFor}
          gymId={gym.id}
          prixMensualite={gym.prixMensualite}
          onClose={() => setPayingMensualiteFor(null)}
          onPaid={() => { setPayingMensualiteFor(null); load(); }}
        />
      )}

      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {userNotice && <div role="status" className="card p-4">{userNotice}</div>}
        {newMemberNotice && <div role="status" style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--success-dim)', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>{newMemberNotice}</div>}

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
              {key === 'adherents' && members.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 16, padding: '0 5px', borderRadius: 99,
                  fontSize: 10, fontWeight: 700,
                  background: tab === key ? 'rgba(181,255,45,0.15)' : 'var(--card3)',
                  color: tab === key ? 'var(--accent)' : 'var(--fg3)',
                }}>
                  {members.length}
                </span>
              )}
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

        {/* ══ ADHÉRENTS ═══════════════════════════════════ */}
        {tab === 'adherents' && (() => {
          const q = memberSearch.trim().toLowerCase();
          let filtered = members;
          if (memberStatut) filtered = filtered.filter((m) => m.statut === memberStatut);
          if (q) filtered = filtered.filter((m) =>
            `${m.prenom} ${m.nom}`.toLowerCase().includes(q) ||
            m.telephone.includes(q) ||
            m.numeroCarte.toLowerCase().includes(q)
          );
          const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
          const page = Math.min(memberPage, totalPages);
          const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

          // counts per statut for tabs
          const statutCounts: Record<string, number> = { '': members.length };
          for (const m of members) statutCounts[m.statut] = (statutCounts[m.statut] ?? 0) + 1;

          return (
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                  <Search size={12} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg3)', pointerEvents: 'none',
                  }} />
                  <input
                    type="search"
                    className="input-base"
                    placeholder="Nom, téléphone, n° carte…"
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                    style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }}
                  />
                </div>
                <span style={{ fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                  <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span>
                  {' '}adhérent{filtered.length !== 1 ? 's' : ''}
                </span>
                <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', marginLeft: 8 }} onClick={() => setShowNewMember(true)}>
                  <UserPlus size={13} /> Inscrire
                </button>
              </div>

              {/* Statut filter tabs */}
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                {MEMBER_FILTER_TABS.map(({ key, label }) => {
                  const active = memberStatut === key;
                  const count = statutCounts[key] ?? 0;
                  return (
                    <button key={key || 'all'} onClick={() => { setMemberStatut(key); setMemberPage(1); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--fg)' : 'var(--fg3)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', transition: 'color 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}
                    >
                      {label}
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, background: active ? 'var(--accent-dim)' : 'var(--border)', color: active ? 'var(--accent)' : 'var(--fg3)', padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              {members.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                  Aucun adhérent enregistré pour cette salle
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                  Aucun résultat pour les filtres sélectionnés
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Adhérent</th>
                      <th>N° Carte</th>
                      <th>Téléphone</th>
                      <th>Statut</th>
                      <th>Expiration</th>
                      <th style={{ minWidth: 230 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((m, i) => {
                      const globalIdx = (page - 1) * PAGE_SIZE + i + 1;
                      const exp = m.subscriptions?.[0]?.dateExpiration;
                      const smeta = MEMBER_STATUT_META[m.statut] ?? MEMBER_STATUT_META.EXPIRE;
                      const isToggling = togglingCarteId === m.id;
                      return (
                        <tr key={m.id}>
                          <td>
                            <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)' }}>
                              {String(globalIdx).padStart(2, '0')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: m.carteActive ? 'var(--fg2)' : 'var(--danger)', background: m.carteActive ? 'var(--card3)' : 'var(--danger-dim)', padding: '2px 7px', borderRadius: 5, textDecoration: m.carteActive ? 'none' : 'line-through' }}>
                              {m.numeroCarte}
                            </span>
                          </td>
                          <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{m.telephone}</td>
                          <td><span className={smeta.cls} style={{ fontSize: 10 }}>{smeta.label}</span></td>
                          <td style={{ color: 'var(--fg3)', fontSize: 12 }}>
                            {exp ? new Date(exp).toLocaleDateString('fr-FR') : <span style={{ color: 'var(--border3)' }}>—</span>}
                          </td>
                          <td>
                            <button
                              onClick={() => toggleMemberCarte(m)}
                              disabled={isToggling}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                fontSize: 11.5, fontWeight: 600, opacity: isToggling ? 0.5 : 1,
                                background: m.carteActive ? 'var(--danger-dim)' : 'var(--success-dim)',
                                color: m.carteActive ? 'var(--danger)' : 'var(--success)',
                                transition: 'opacity 0.15s',
                              }}
                            >
                              {isToggling
                                ? <Spinner size="sm" />
                                : m.carteActive
                                  ? <><ShieldOff size={11} /> Bloquer</>
                                  : <><ShieldCheck size={11} /> Débloquer</>
                              }
                            </button>
                            <button
                              onClick={() => setPayingMensualiteFor(m)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)' }}
                            >
                              <CalendarCheck size={11} /> Mensualité
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderTop: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost"
                    style={{ padding: '5px 10px', fontSize: 12, gap: 4 }}
                  >
                    <ChevronLeft size={13} /> Précédent
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                    Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{page}</span> / <span className="num">{totalPages}</span>
                  </span>
                  <button
                    onClick={() => setMemberPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-ghost"
                    style={{ padding: '5px 10px', fontSize: 12, gap: 4 }}
                  >
                    Suivant <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ ÉQUIPE ══════════════════════════════════════ */}
        {tab === 'equipe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stats row */}
            {users.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="card-accent" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="section-label">Total équipe</span>
                  <span className="stat-value stat-value-accent num" style={{ fontSize: 24 }}>{users.length}</span>
                </div>
                <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="section-label">Comptes actifs</span>
                  <span className="stat-value num" style={{ fontSize: 24, color: 'var(--success)' }}>
                    {users.filter((u) => u.actif).length}
                  </span>
                </div>
                <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="section-label">Admins</span>
                  <span className="stat-value num" style={{ fontSize: 24, color: 'var(--fg)' }}>
                    {users.filter((u) => u.role === 'ADMIN').length}
                  </span>
                </div>
              </div>
            )}

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
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span className="section-label">Membres de l'équipe</span>
                  <button className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setShowNewUser(true)}>
                    <UserPlus size={12} /> Ajouter
                  </button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                      <th>Rôle</th>
                      <th>Statut</th>
                      <th style={{ width: 144 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const roleMeta = ROLE_META[u.role] ?? { label: u.role, cls: 'badge badge-neutral' };
                      const isToggling = togglingUserId === u.id;
                      return (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</td>
                          <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.email}</td>
                          <td style={{ color: 'var(--fg2)', fontSize: 13, whiteSpace: 'nowrap' }}>{u.telephone || '—'}</td>
                          <td><span className={roleMeta.cls} style={{ fontSize: 10 }}>{roleMeta.label}</span></td>
                          <td>
                            <span className={u.actif ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: 10 }}>
                              {u.actif ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                              aria-label={`${u.actif ? 'Désactiver' : 'Activer'} le compte de ${u.prenom} ${u.nom}`}
                              onClick={() => toggleUser(u)}
                              disabled={isToggling}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                width: 32, height: 32, padding: 0, borderRadius: 7, border: 'none', cursor: 'pointer',
                                fontSize: 11.5, fontWeight: 600, opacity: isToggling ? 0.5 : 1,
                                background: u.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                                color: u.actif ? 'var(--danger)' : 'var(--success)',
                                transition: 'opacity 0.15s',
                              }}
                            >
                              {isToggling
                                ? <Spinner size="sm" />
                                : u.actif
                                  ? <ShieldOff size={15} />
                                  : <ShieldCheck size={15} />
                              }
                            </button>
                            <StaffAccountActions user={u} gymId={gym.id}
                              onUpdated={(updated) => setUsers((previous) => previous.map((item) => item.id === updated.id ? { ...item, ...updated } : item))} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ PAIEMENTS ═══════════════════════════════════ */}
        {tab === 'paiements' && (() => {
          const q = paymentSearch.trim().toLowerCase();
          const filteredPay = payments.filter((p) => {
            if (q && !`${p.member.prenom} ${p.member.nom}`.toLowerCase().includes(q)) return false;
            if (paymentDateDebut && p.createdAt < paymentDateDebut) return false;
            if (paymentDateFin && p.createdAt.slice(0, 10) > paymentDateFin) return false;
            return true;
          });
          return payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="Aucun paiement" subtitle="Les paiements de cette salle apparaîtront ici" />
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 260 }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
                  <input type="search" className="input-base" placeholder="Nom de l'adhérent…" value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                  <Filter size={12} style={{ color: 'var(--fg3)' }} />
                  <input type="date" className="input-base" value={paymentDateDebut}
                    onChange={(e) => setPaymentDateDebut(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', width: 140 }} />
                  <span style={{ fontSize: 12, color: 'var(--fg3)' }}>→</span>
                  <input type="date" className="input-base" value={paymentDateFin}
                    onChange={(e) => setPaymentDateFin(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', width: 140 }} />
                  {(paymentDateDebut || paymentDateFin || paymentSearch) && (
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => { setPaymentSearch(''); setPaymentDateDebut(''); setPaymentDateFin(''); }}>
                      <X size={11} /> Reset
                    </button>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    {fmtFcfa(filteredPay.reduce((s, p) => s + p.montantFcfa, 0))}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{filteredPay.length} paiement{filteredPay.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {filteredPay.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Aucun résultat pour ces filtres</div>
              ) : (
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
                    {filteredPay.map((p) => (
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
              )}
            </div>
          );
        })()}

      </div>
    </Shell>
  );
}
