'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa, Gym } from '@/lib/api';
import { Users, Search, AlertCircle, RefreshCw, Shield, UserCog, CheckCircle, XCircle } from 'lucide-react';

interface StaffUser {
  id: string; prenom: string; nom: string; email: string;
  role: 'ADMIN' | 'GERANT'; actif: boolean; gymId: string; createdAt: string;
  gym: { id: string; nom: string; slug: string };
}

type RoleFilter = '' | 'ADMIN' | 'GERANT';
const PAGE_SIZE = 25;

const ROLE_META = {
  ADMIN:  { label: 'Propriétaire', cls: 'badge badge-accent' },
  GERANT: { label: 'Réceptionniste', cls: 'badge badge-blue' },
};

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: '',       label: 'Tous' },
  { key: 'ADMIN',  label: 'Propriétaires' },
  { key: 'GERANT', label: 'Réceptionnistes' },
];

export default function UsersPage() {
  const [users, setUsers]       = useState<StaffUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [gymFilter, setGymFilter]   = useState('');
  const [page, setPage]         = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gym/all-users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // unique gyms for filter
  const gymsList = useMemo(() =>
    [...new Map(users.map((u) => [u.gym.id, u.gym])).values()].sort((a, b) => a.nom.localeCompare(b.nom)),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (gymFilter)  list = list.filter((u) => u.gym.id === gymFilter);
    if (q)          list = list.filter((u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
    return list;
  }, [users, search, roleFilter, gymFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // counts for tabs
  const roleCounts = useMemo(() => {
    const base = users.filter((u) => gymFilter ? u.gym.id === gymFilter : true);
    return {
      '': base.length,
      ADMIN:  base.filter((u) => u.role === 'ADMIN').length,
      GERANT: base.filter((u) => u.role === 'GERANT').length,
    };
  }, [users, gymFilter]);

  async function toggleUser(u: StaffUser) {
    setTogglingId(u.id);
    try {
      await adminApi.patch(`/api/v1/gym/user/${u.id}/toggle`);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  // stats
  const nbActifs = users.filter((u) => u.actif).length;

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
          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Total comptes</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><Users size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>{users.length}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Propriétaires</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28 }}>{roleCounts.ADMIN}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Réceptionnistes</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28 }}>{roleCounts.GERANT}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Comptes actifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--success)' }}>{nbActifs}</div>}
          </div>
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
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 120px 100px 90px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: 11, width: 160 }} />
                    <div className="skeleton" style={{ height: 10, width: 140 }} />
                    <div className="skeleton" style={{ height: 20, width: 90 }} />
                    <div className="skeleton" style={{ height: 20, width: 60 }} />
                    <div className="skeleton" style={{ height: 28, width: 80 }} />
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
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</td>
                      <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.email}</td>
                      <td>
                        <Link href={`/gyms/${u.gym.slug}`} style={{ fontSize: 12, color: 'var(--fg2)', textDecoration: 'none', transition: 'color 0.15s' }}
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
                        <button
                          onClick={() => toggleUser(u)}
                          disabled={togglingId === u.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                            background: u.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                            color: u.actif ? 'var(--danger)' : 'var(--success)',
                            transition: 'opacity 0.15s',
                            opacity: togglingId === u.id ? 0.5 : 1,
                          }}
                        >
                          {togglingId === u.id ? <Spinner size="sm" /> : u.actif ? <XCircle size={12} /> : <CheckCircle size={12} />}
                          {u.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && !loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, gap: 4 }}>
                  ← Précédent
                </button>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span>
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, gap: 4 }}>
                  Suivant →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
