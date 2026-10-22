'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import {
  Users, Search, AlertCircle, RefreshCw, CheckCircle, XCircle,
  Pencil, X, KeyRound, Phone,
} from 'lucide-react';

interface StaffUser {
  id: string; prenom: string; nom: string; email: string;
  role: 'ADMIN' | 'GERANT'; actif: boolean; gymId: string;
  telephone?: string | null; createdAt: string;
  gym: { id: string; nom: string; slug: string };
}

type RoleFilter = '' | 'ADMIN' | 'GERANT';
const PAGE_SIZE = 25;

const ROLE_META = {
  ADMIN:  { label: 'Propriétaire', cls: 'badge badge-accent' },
  GERANT: { label: 'Réceptionniste', cls: 'badge badge-blue' },
};
const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'ADMIN', label: 'Propriétaires' },
  { key: 'GERANT', label: 'Réceptionnistes' },
];

/* ── Edit modal ─────────────────────────────────────────────── */
function EditModal({ user, onClose, onSaved }: {
  user: StaffUser;
  onClose: () => void;
  onSaved: (updated: StaffUser) => void;
}) {
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [prenom, setPrenom] = useState(user.prenom);
  const [nom, setNom] = useState(user.nom);
  const [role, setRole] = useState<'ADMIN' | 'GERANT'>(user.role);
  const [telephone, setTelephone] = useState(user.telephone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (saving || notice) return;
    setSaving(true); setError('');
    try {
      const r = await adminApi.patch(`/api/v1/users/admin/${user.id}`, {
        gymId: user.gymId,
        ...(prenom !== user.prenom ? { prenom } : {}),
        ...(nom !== user.nom ? { nom } : {}),
        ...(role !== user.role ? { role } : {}),
        ...(telephone !== (user.telephone ?? '') ? { telephone } : {}),
      });
      onSaved(r.data);
      setNotice('Modifications enregistrées.');
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible de sauvegarder. Réessayez.');
    } finally { setSaving(false); }
  }

  async function resetPassword() {
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await adminApi.post(`/api/v1/users/admin/${user.id}/reset-password`, { gymId: user.gymId });
      onSaved(r.data.user);
      setNotice(r.data.whatsapp?.status === 'accepted'
        ? 'Mot de passe temporaire envoyé via WhatsApp. L\'utilisateur devra le changer à la prochaine connexion.'
        : 'Mot de passe renouvelé, mais l\'envoi WhatsApp n\'est pas confirmé. Vérifiez Relayio.');
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Renouvellement impossible. Réessayez.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>
              {user.prenom} {user.nom}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 12 }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 4, marginBottom: 12 }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {([['info', 'Informations'], ['password', 'Mot de passe']] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setError(''); setNotice(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontSize: 12.5, fontWeight: tab === key ? 700 : 500, color: tab === key ? 'var(--fg)' : 'var(--fg3)', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {tab === 'info' ? (
            <form onSubmit={saveInfo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Prénom</label>
                  <input className="input-base" value={prenom} onChange={(e) => setPrenom(e.target.value)} style={{ width: '100%', fontSize: 13 }} required />
                </div>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Nom</label>
                  <input className="input-base" value={nom} onChange={(e) => setNom(e.target.value)} style={{ width: '100%', fontSize: 13 }} required />
                </div>
              </div>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Rôle</label>
                <select className="input-base" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'GERANT')} style={{ width: '100%', fontSize: 13 }}>
                  <option value="ADMIN">Propriétaire</option>
                  <option value="GERANT">Réceptionniste</option>
                </select>
              </div>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>
                  <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />Numéro WhatsApp
                </label>
                <input className="input-base" type="tel" value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+221 77 000 00 00" style={{ width: '100%', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>Indicatif +221 ajouté automatiquement si absent</div>
              </div>
              {error && <div className="banner-error" role="alert" style={{ fontSize: 12 }}><AlertCircle size={12} /> {error}</div>}
              {notice && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 12 }}><CheckCircle size={12} /> {notice}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '9px 14px', fontSize: 13, borderRadius: 9 }}>Fermer</button>
                {!notice && (
                  <button type="submit" disabled={saving} className="btn-primary"
                    style={{ padding: '9px 16px', fontSize: 13, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Spinner size="sm" /> : <CheckCircle size={13} />}
                    Enregistrer
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.7, background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px' }}>
                Un mot de passe temporaire simple sera généré et envoyé via WhatsApp au <strong>{user.telephone || 'numéro enregistré'}</strong>.<br />
                L'utilisateur devra le changer à sa prochaine connexion. Toutes ses sessions actives seront déconnectées.
              </div>
              {!user.actif && (
                <div className="banner-error" style={{ fontSize: 12 }}>
                  <AlertCircle size={12} /> Ce compte est inactif. Activez-le d'abord.
                </div>
              )}
              {!user.telephone && (
                <div className="banner-error" style={{ fontSize: 12 }}>
                  <AlertCircle size={12} /> Aucun numéro WhatsApp. Ajoutez-en un dans l'onglet Informations.
                </div>
              )}
              {error && <div className="banner-error" role="alert" style={{ fontSize: 12 }}><AlertCircle size={12} /> {error}</div>}
              {notice ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--success)', fontSize: 12 }}><CheckCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {notice}</div>
              ) : (
                <button
                  onClick={resetPassword}
                  disabled={saving || !user.actif || !user.telephone}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', fontSize: 13, borderRadius: 9, opacity: (saving || !user.actif || !user.telephone) ? 0.5 : 1 }}>
                  {saving ? <Spinner size="sm" /> : <KeyRound size={13} />}
                  Envoyer un nouveau mot de passe
                </button>
              )}
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 13, borderRadius: 9, alignSelf: 'flex-end' }}>Fermer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function UsersPage() {
  const [users, setUsers]     = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [gymFilter, setGymFilter]   = useState('');
  const [page, setPage]       = useState(1);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gym/all-users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const gymsList = useMemo(() =>
    [...new Map(users.map((u) => [u.gym.id, u.gym])).values()].sort((a, b) => a.nom.localeCompare(b.nom)),
    [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (gymFilter)  list = list.filter((u) => u.gym.id === gymFilter);
    if (q)          list = list.filter((u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list;
  }, [users, search, roleFilter, gymFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const roleCounts = useMemo(() => {
    const base = users.filter((u) => gymFilter ? u.gym.id === gymFilter : true);
    return { '': base.length, ADMIN: base.filter((u) => u.role === 'ADMIN').length, GERANT: base.filter((u) => u.role === 'GERANT').length };
  }, [users, gymFilter]);

  async function toggleUser(u: StaffUser) {
    setTogglingId(u.id);
    try {
      await adminApi.patch(`/api/v1/gym/user/${u.id}/toggle`);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  function onUserSaved(updated: StaffUser) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
    if (editingUser?.id === updated.id) setEditingUser((p) => p ? { ...p, ...updated } : p);
  }

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 className="page-title">Équipe salles</h1>
          <p className="page-sub">Comptes staff sur toutes les salles</p>
        </div>

        {error && (
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total comptes', value: users.length, color: 'var(--accent)' },
            { label: 'Propriétaires', value: roleCounts.ADMIN, color: 'var(--fg2)' },
            { label: 'Réceptionnistes', value: roleCounts.GERANT, color: 'var(--fg2)' },
            { label: 'Comptes actifs', value: users.filter((u) => u.actif).length, color: 'var(--success)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="section-label">{label}</span>
              {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} />
                : <div className="stat-value" style={{ fontSize: 28, color }}>{value}</div>}
            </div>
          ))}
        </div>

        {/* Table card */}
        {!loading && !error && users.length === 0 ? (
          <EmptyState icon={Users} title="Aucun utilisateur" subtitle="Créez des comptes depuis les pages salles" />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
                <input type="search" className="input-base" placeholder="Nom, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }} />
              </div>
              {gymsList.length > 1 && (
                <select value={gymFilter} onChange={(e) => { setGymFilter(e.target.value); setPage(1); }}
                  className="input-base" style={{ fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)', minWidth: 140 }}>
                  <option value="">Toutes les salles</option>
                  {gymsList.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span> compte{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Role tabs */}
            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
              {ROLE_TABS.map(({ key, label }) => {
                const active = roleFilter === key;
                return (
                  <button key={key || 'all'} onClick={() => { setRoleFilter(key); setPage(1); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--fg)' : 'var(--fg3)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}>
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
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 100px 90px 80px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    {Array.from({ length: 6 }).map((__, j) => <div key={j} className="skeleton" style={{ height: 10 }} />)}
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucun compte ne correspond aux filtres
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Salle</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th style={{ width: 130 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.prenom} {u.nom}</div>
                        {u.telephone && <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 2 }}>{u.telephone}</div>}
                      </td>
                      <td style={{ color: 'var(--fg2)', fontSize: 12.5 }}>{u.email}</td>
                      <td>
                        <Link href={`/gyms/${u.gym.slug}`} style={{ fontSize: 12, color: 'var(--fg2)', textDecoration: 'none' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg2)')}>
                          {u.gym.nom}
                        </Link>
                      </td>
                      <td><span className={ROLE_META[u.role].cls} style={{ fontSize: 10 }}>{ROLE_META[u.role].label}</span></td>
                      <td>
                        <span className={u.actif ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: 10 }}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {/* Edit button */}
                          <button onClick={() => setEditingUser(u)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }}>
                            <Pencil size={11} /> Modifier
                          </button>
                          {/* Toggle */}
                          <button onClick={() => toggleUser(u)} disabled={togglingId === u.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: u.actif ? 'var(--danger-dim)' : 'var(--success-dim)', color: u.actif ? 'var(--danger)' : 'var(--success)', opacity: togglingId === u.id ? 0.5 : 1 }}>
                            {togglingId === u.id ? <Spinner size="sm" /> : u.actif ? <XCircle size={11} /> : <CheckCircle size={11} />}
                            {u.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && !loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>← Précédent</button>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span>
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>Suivant →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={onUserSaved}
        />
      )}
    </Shell>
  );
}
