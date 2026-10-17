'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { UserCircle, Search, AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface GymbroUserRow {
  id: string; prenom: string; nom: string; email: string;
  telephone?: string; actif: boolean; createdAt: string;
  subscriptions: { statut: string; dateExpiration: string; montantFcfa: number }[];
}

const SUB_META: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Actif',     cls: 'badge badge-success' },
  EXPIRED:   { label: 'Expiré',    cls: 'badge badge-danger' },
  CANCELLED: { label: 'Annulé',    cls: 'badge badge-neutral' },
  PENDING:   { label: 'En attente',cls: 'badge badge-warning' },
};

const PAGE_SIZE = 25;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GymbroUtilisateursPage() {
  const [users, setUsers]     = useState<GymbroUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gym/gymbro-users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.telephone ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const nbAbonnes  = useMemo(() => users.filter((u) => u.subscriptions[0]?.statut === 'ACTIVE').length, [users]);
  const nbSansAbo  = useMemo(() => users.filter((u) => u.subscriptions.length === 0).length, [users]);
  const nbInactifs = useMemo(() => users.filter((u) => !u.actif).length, [users]);

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 className="page-title">Utilisateurs GymBro</h1>
          <p className="page-sub">Membres de l'application fitness indépendante</p>
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
              <span className="section-label">Total</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><UserCircle size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>{users.length}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Abonnés actifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--success)' }}>{nbAbonnes}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Sans abonnement</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28 }}>{nbSansAbo}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Inactifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--danger)' }}>{nbInactifs}</div>}
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
                <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span> utilisateur{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 180px 110px 100px 110px 100px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: 10, width: 20 }} />
                    <div className="skeleton" style={{ height: 11, width: 140 }} />
                    <div className="skeleton" style={{ height: 10, width: 160 }} />
                    <div className="skeleton" style={{ height: 10, width: 90 }} />
                    <div className="skeleton" style={{ height: 20, width: 70 }} />
                    <div className="skeleton" style={{ height: 10, width: 80 }} />
                    <div className="skeleton" style={{ height: 10, width: 80 }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucun utilisateur ne correspond à la recherche
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Abonnement</th>
                    <th>Expire le</th>
                    <th>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((u, i) => {
                    const sub = u.subscriptions[0];
                    const subMeta = sub ? (SUB_META[sub.statut] ?? { label: sub.statut, cls: 'badge badge-neutral' }) : null;
                    return (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--fg3)', fontSize: 12 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{u.prenom} {u.nom}</td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.email}</td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{u.telephone ?? '—'}</td>
                        <td>
                          {subMeta
                            ? <span className={subMeta.cls} style={{ fontSize: 10 }}>{subMeta.label}</span>
                            : <span style={{ color: 'var(--fg3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>
                          {sub ? fmtDate(sub.dateExpiration) : '—'}
                        </td>
                        <td style={{ color: 'var(--fg3)', fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
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
    </Shell>
  );
}
