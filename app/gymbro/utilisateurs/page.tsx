'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { isAxiosError } from 'axios';
import {
  UserCircle, Search, AlertCircle, RefreshCw,
  Users, Award, ChevronDown, XCircle, CheckCircle, Eye,
  UserPlus, X, Copy, Check,
} from 'lucide-react';

/* ── types ─────────────────────────────────────────────── */
type GymbroRole = 'USER' | 'COACH';

interface GymbroUserRow {
  id: string; prenom: string; nom: string; email: string;
  telephone?: string; role: GymbroRole; actif: boolean; createdAt: string;
  subscriptions: { statut: string; dateExpiration: string; montantFcfa: number }[];
}

type RoleFilter = '' | 'USER' | 'COACH';

interface CreateForm {
  prenom: string; nom: string; telephone: string; role: GymbroRole;
}

const LETTERS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS  = '0123456789';
function genPassword() {
  const letters = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  const digits  = Array.from({ length: 4 }, () => DIGITS[Math.floor(Math.random() * DIGITS.length)]).join('');
  return letters + digits; // ex: "kbmx5291"
}

/* ── constants ─────────────────────────────────────────── */
const PAGE_SIZE = 25;

const SUB_META: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Actif',       cls: 'badge badge-success' },
  EXPIRED:   { label: 'Expiré',      cls: 'badge badge-danger'  },
  CANCELLED: { label: 'Annulé',      cls: 'badge badge-neutral' },
  PENDING:   { label: 'En attente',  cls: 'badge badge-warning' },
};

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: '',      label: 'Tous' },
  { key: 'USER',  label: 'Utilisateurs' },
  { key: 'COACH', label: 'Coachs' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── page ───────────────────────────────────────────────── */
export default function GymbroUtilisateursPage() {
  const router = useRouter();
  const [users, setUsers]         = useState<GymbroUserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [page, setPage]           = useState(1);
  const [roleMenu, setRoleMenu]         = useState<string | null>(null);
  const [roleMenuRect, setRoleMenuRect] = useState<DOMRect | null>(null);
  const [togglingActifId, setTogglingActifId] = useState<string | null>(null);

  const EMPTY_FORM: CreateForm = { prenom: '', nom: '', telephone: '', role: 'USER' };
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState<CreateForm>(EMPTY_FORM);
  const [genPwd, setGenPwd]             = useState('');
  const [copiedPwd, setCopiedPwd]       = useState(false);
  const [formError, setFormError]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [creationNotice, setCreationNotice] = useState<{ accepted: boolean; message: string } | null>(null);

  function setF(k: keyof CreateForm, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openCreate() {
    setForm(EMPTY_FORM); setGenPwd(genPassword()); setFormError('');
    setCopiedPwd(false); setCreationNotice(null); setShowCreate(true);
  }

  function copyVal(val: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(val).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function createUser() {
    if (saving) return;
    if (!form.prenom.trim() || !form.nom.trim() || !form.telephone.trim()) {
      setFormError('Prénom, nom et téléphone sont obligatoires.');
      return;
    }
    setSaving(true); setFormError('');
    try {
      const { data } = await adminApi.post('/api/v1/gym/gymbro-user', {
        prenom: form.prenom.trim(), nom: form.nom.trim(),
        telephone: form.telephone.trim(), password: genPwd,
        role: form.role,
      });
      const { whatsapp, ...created } = data;
      setUsers((prev) => [{ ...created, subscriptions: [] }, ...prev]);
      const accepted = whatsapp?.status === 'accepted';
      setCreationNotice({ accepted, message: accepted
        ? `Compte de ${created.prenom} créé. Les identifiants ont été transmis à Relayio pour envoi automatique sur WhatsApp.`
        : `Compte de ${created.prenom} créé, mais l’envoi WhatsApp n’a pas été confirmé. Vérifiez la connexion Relayio. Ne recréez pas le compte.` });
      setShowCreate(false);
      setGenPwd('');
    } catch (error: unknown) {
      setFormError(isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Une erreur est survenue.' : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(() => {
    adminApi.get('/api/v1/gym/gymbro-users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  function reload() { setLoading(true); setError(''); load(); }

  useEffect(() => { load(); }, [load]);

  /* close dropdown on outside click or scroll */
  useEffect(() => {
    if (!roleMenu) return;
    const close = () => { setRoleMenu(null); setRoleMenuRect(null); };
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [roleMenu]);

  async function toggleActif(u: GymbroUserRow) {
    setTogglingActifId(u.id);
    try {
      await adminApi.patch(`/api/v1/gym/gymbro-user/${u.id}/toggle-actif`);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingActifId(null); }
  }

  async function changeRole(u: GymbroUserRow, newRole: GymbroRole) {
    setRoleMenu(null);
    try {
      await adminApi.patch(`/api/v1/gym/gymbro-user/${u.id}/role`, { role: newRole });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x));
    } catch { /* ignore */ }
  }

  /* filters */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (q) list = list.filter((u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.telephone ?? '').includes(q)
    );
    return list;
  }, [users, search, roleFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* stats */
  const nbCoachs   = useMemo(() => users.filter((u) => u.role === 'COACH').length, [users]);
  const nbAbonnes  = useMemo(() => users.filter((u) => u.subscriptions[0]?.statut === 'ACTIVE').length, [users]);
  const nbSansAbo  = useMemo(() => users.filter((u) => u.subscriptions.length === 0).length, [users]);

  /* role tab counts */
  const roleCounts = useMemo(() => ({
    '': users.length,
    USER:  users.filter((u) => u.role === 'USER').length,
    COACH: users.filter((u) => u.role === 'COACH').length,
  }), [users]);

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Utilisateurs GymBro</h1>
            <p className="page-sub">Membres et coachs de l&apos;application fitness</p>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap' }}
          >
            <UserPlus size={14} /> Nouvel utilisateur
          </button>
        </div>

        {error && (
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={reload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {creationNotice && <div role={creationNotice.accepted ? 'status' : 'alert'} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', color: creationNotice.accepted ? 'var(--success)' : 'var(--warning)' }}>
          {creationNotice.accepted ? <CheckCircle size={17} /> : <AlertCircle size={17} />}
          <span style={{ flex: 1, fontSize: 13 }}>{creationNotice.message}</span>
          <button type="button" onClick={() => setCreationNotice(null)} aria-label="Fermer la notification" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}><X size={15} /></button>
        </div>}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Total inscrits</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Users size={13} />
              </span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 60 }} />
              : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>{users.length}</div>}
          </div>

          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Coachs</span>
              <Award size={13} style={{ color: 'var(--warning)' }} />
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} />
              : <div className="stat-value" style={{ fontSize: 28, color: 'var(--warning)' }}>{nbCoachs}</div>}
          </div>

          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Abonnés actifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} />
              : <div className="stat-value" style={{ fontSize: 28, color: 'var(--success)' }}>{nbAbonnes}</div>}
          </div>

          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Sans abonnement</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} />
              : <div className="stat-value" style={{ fontSize: 28 }}>{nbSansAbo}</div>}
          </div>
        </div>

        {!loading && !error && users.length === 0 ? (
          <EmptyState icon={UserCircle} title="Aucun utilisateur GymBro" subtitle="Les inscriptions apparaîtront ici" />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
                <input type="search" className="input-base" placeholder="Nom, email, téléphone…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }} />
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span>
                {' '}utilisateur{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Role tabs */}
            <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
              {ROLE_TABS.map(({ key, label }) => {
                const active = roleFilter === key;
                return (
                  <button key={key || 'all'} onClick={() => { setRoleFilter(key); setPage(1); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--fg)' : 'var(--fg3)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', transition: 'color 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}
                  >
                    {label}
                    {!loading && (
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, background: active ? 'var(--accent-dim)' : 'var(--border)', color: active ? 'var(--accent)' : 'var(--fg3)', padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                        {roleCounts[key]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 180px 110px 80px 100px 100px 100px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: 10, width: 20 }} />
                    <div className="skeleton" style={{ height: 11, width: 140 }} />
                    <div className="skeleton" style={{ height: 10, width: 160 }} />
                    <div className="skeleton" style={{ height: 10, width: 90 }} />
                    <div className="skeleton" style={{ height: 20, width: 60 }} />
                    <div className="skeleton" style={{ height: 20, width: 70 }} />
                    <div className="skeleton" style={{ height: 10, width: 80 }} />
                    <div className="skeleton" style={{ height: 28, width: 90 }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucun utilisateur ne correspond aux filtres
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Rôle</th>
                    <th>Abonnement</th>
                    <th>Expire le</th>
                    <th style={{ width: 100 }}>Statut</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((u, i) => {
                    const sub     = u.subscriptions[0];
                    const subMeta = sub ? (SUB_META[sub.statut] ?? { label: sub.statut, cls: 'badge badge-neutral' }) : null;
                    const isCoach = u.role === 'COACH';
                    return (
                      <tr key={u.id}>
                        <td>
                          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)' }}>
                            {String((currentPage - 1) * PAGE_SIZE + i + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isCoach && <Award size={11} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
                            <span style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.email}</td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.telephone ?? '—'}</td>
                        <td>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                            background: isCoach ? 'rgba(255,170,0,0.12)' : 'var(--border)',
                            color: isCoach ? 'var(--warning)' : 'var(--fg3)',
                          }}>
                            {isCoach ? 'Coach' : 'Utilisateur'}
                          </span>
                        </td>
                        <td>
                          {subMeta
                            ? <span className={subMeta.cls} style={{ fontSize: 10 }}>{subMeta.label}</span>
                            : <span style={{ color: 'var(--fg3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--fg2)', fontSize: 12 }}>
                          {sub ? fmtDate(sub.dateExpiration) : '—'}
                        </td>
                        <td>
                          <span className={u.actif ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: 10 }}>
                            {u.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* View detail */}
                            <button
                              onClick={() => router.push(`/gymbro/utilisateurs/${u.id}`)}
                              title="Voir le profil"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)',
                                background: 'var(--bg2)', cursor: 'pointer', color: 'var(--fg3)', flexShrink: 0,
                              }}
                            >
                              <Eye size={12} />
                            </button>
                            {/* Toggle actif */}
                            <button
                              onClick={() => toggleActif(u)}
                              disabled={togglingActifId === u.id}
                              title={u.actif ? 'Désactiver le compte' : 'Activer le compte'}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
                                background: u.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                                color: u.actif ? 'var(--danger)' : 'var(--success)',
                                opacity: togglingActifId === u.id ? 0.5 : 1,
                                flexShrink: 0,
                              }}
                            >
                              {togglingActifId === u.id ? <Spinner size="sm" /> : u.actif ? <XCircle size={12} /> : <CheckCircle size={12} />}
                            </button>
                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (roleMenu === u.id) { setRoleMenu(null); setRoleMenuRect(null); }
                                else { setRoleMenu(u.id); setRoleMenuRect(e.currentTarget.getBoundingClientRect()); }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border2)',
                                background: 'var(--card2)', cursor: 'pointer',
                                fontSize: 11.5, fontWeight: 600, color: 'var(--fg2)',
                                transition: 'border-color 0.15s, color 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--border3)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
                            >
                              {isCoach ? 'Retirer coach' : 'Promouvoir'}
                              <ChevronDown size={10} />
                            </button>
                          </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && !loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>
                  ← Précédent
                </button>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span>
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>
                  Suivant →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Create user modal ── */}
      {showCreate && (
        <div
          onClick={() => { if (!saving) setShowCreate(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeUp 0.15s ease both' }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <UserPlus size={15} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>Nouvel utilisateur GymBro</div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Créer un compte membre ou coach</div>
                </div>
              </div>
              <button disabled={saving} onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7 }}>
                <X size={14} />
              </button>
            </div>

              {/* ── Form ── */}
              <>
                <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Role selector */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Rôle</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {(['USER', 'COACH'] as GymbroRole[]).map((r) => {
                        const active = form.role === r;
                        return (
                          <button key={r} onClick={() => setF('role', r)}
                            style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`, background: active ? 'var(--accent-dim)' : 'var(--bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}>
                            {r === 'COACH'
                              ? <Award size={13} style={{ color: active ? 'var(--accent)' : 'var(--warning)' }} />
                              : <UserCircle size={13} style={{ color: active ? 'var(--accent)' : 'var(--fg3)' }} />}
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--fg2)' }}>
                              {r === 'COACH' ? 'Coach' : 'Utilisateur'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Prénom *</label>
                      <input className="input-base" value={form.prenom} onChange={(e) => setF('prenom', e.target.value)}
                        placeholder="Jean" style={{ width: '100%', fontSize: 13 }} />
                    </div>
                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Nom *</label>
                      <input className="input-base" value={form.nom} onChange={(e) => setF('nom', e.target.value)}
                        placeholder="Dupont" style={{ width: '100%', fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Telephone (obligatoire) */}
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Téléphone *</label>
                    <input className="input-base" value={form.telephone} onChange={(e) => setF('telephone', e.target.value)}
                      placeholder="+221 77 000 00 00" style={{ width: '100%', fontSize: 13 }} />
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--fg3)' }}>Les identifiants seront envoyés automatiquement sur WhatsApp après la création.</p>
                  </div>

                  {/* Generated password */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mot de passe généré</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="num" style={{ flex: 1, fontSize: 14, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {genPwd}
                      </div>
                      <button onClick={() => setGenPwd(genPassword())} title="Régénérer"
                        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg3)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button onClick={() => copyVal(genPwd, setCopiedPwd)} title="Copier"
                        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copiedPwd ? 'var(--success)' : 'var(--fg3)' }}
                      >
                        {copiedPwd ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--danger-dim)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: 8, padding: '9px 12px', color: 'var(--danger)', fontSize: 12 }}>
                      <AlertCircle size={13} style={{ flexShrink: 0 }} /> {formError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, padding: 20, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCreate(false)} disabled={saving} className="btn-ghost" style={{ padding: '9px 16px', fontSize: 13, borderRadius: 9 }}>
                    Annuler
                  </button>
                  <button onClick={createUser} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13, borderRadius: 9, opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Spinner size="sm" /> : <UserPlus size={13} />}
                    {saving ? 'Création et envoi…' : 'Créer le compte'}
                  </button>
                </div>
              </>
          </div>
        </div>
      )}

      {/* ── Role dropdown portal (fixed position, escapes overflow:hidden) ── */}
      {roleMenu && roleMenuRect && (() => {
        const u = users.find((x) => x.id === roleMenu);
        if (!u) return null;
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: roleMenuRect.bottom + 4,
              right: window.innerWidth - roleMenuRect.right,
              zIndex: 9999,
              background: 'var(--card2)', border: '1px solid var(--border2)',
              borderRadius: 10, overflow: 'hidden', minWidth: 180,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'fadeUp 0.12s ease both',
            }}
          >
            {(['USER', 'COACH'] as GymbroRole[]).filter((r) => r !== u.role).map((r) => (
              <button
                key={r}
                onClick={() => { setRoleMenu(null); setRoleMenuRect(null); changeRole(u, r); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--fg2)', transition: 'background 0.12s', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {r === 'COACH'
                  ? <><Award size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} /> Promouvoir en Coach</>
                  : <><UserCircle size={13} style={{ flexShrink: 0 }} /> Retirer le rôle Coach</>
                }
              </button>
            ))}
          </div>
        );
      })()}
    </Shell>
  );
}
