'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import { adminApi, fmtFcfa, Gym } from '@/lib/api';
import {
  Users, AlertCircle, RefreshCw, Search,
  ArrowUp, ArrowDown, ArrowUpDown, MapPin, TrendingUp,
} from 'lucide-react';

/* ── types ─────────────────────────────────────────────── */
interface GymRow {
  id: string; slug: string; nom: string; ville: string; pays: string;
  nbAdherents: number; revenuMois: number;
}

type SortKey = 'nom' | 'nbAdherents' | 'revenuMois';
type SortDir = 'asc' | 'desc';

/* ── page ───────────────────────────────────────────────── */
export default function AdherentsPage() {
  const [rows, setRows]       = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('nbAdherents');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi.get('/api/v1/gym/all')
      .then((r) => {
        const data: Gym[] = Array.isArray(r.data) ? r.data : [];
        setRows(data.map((g) => ({
          id: g.id, slug: g.slug, nom: g.nom, ville: g.ville, pays: g.pays,
          nbAdherents: g.nbAdherents ?? 0,
          revenuMois:  g.revenuMois  ?? 0,
        })));
      })
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'nom' ? 'asc' : 'desc'); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => r.nom.toLowerCase().includes(q) || r.ville.toLowerCase().includes(q))
      : rows;
    return [...list].sort((a, b) => {
      const va = sortKey === 'nom' ? a.nom : a[sortKey];
      const vb = sortKey === 'nom' ? b.nom : b[sortKey];
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, search, sortKey, sortDir]);

  /* stats */
  const total    = rows.reduce((s, r) => s + r.nbAdherents, 0);
  const maxCount = rows.length ? Math.max(...rows.map((r) => r.nbAdherents), 1) : 1;
  const topGym   = rows.length ? [...rows].sort((a, b) => b.nbAdherents - a.nbAdherents)[0] : null;
  const avg      = rows.length ? Math.round(total / rows.length) : 0;

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: active ? 'var(--fg)' : 'var(--fg3)',
          transition: 'color 0.15s',
        }}
      >
        {label} <Icon size={10} />
      </button>
    );
  }

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div>
          <h1 className="page-title">Adhérents</h1>
          <p className="page-sub">Répartition des membres par salle</p>
        </div>

        {/* ── Error ──────────────────────────────────────── */}
        {error && (
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={load} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
            }}>
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {/* ── Stats row ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {/* Total */}
          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Total adhérents</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Users size={13} />
              </span>
            </div>
            {loading
              ? <div className="skeleton" style={{ height: 28, width: 80 }} />
              : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>
                  {total.toLocaleString('fr-FR')}
                </div>
            }
          </div>

          {/* Moyenne */}
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Moyenne / salle</span>
            {loading
              ? <div className="skeleton" style={{ height: 28, width: 60 }} />
              : <div className="stat-value" style={{ fontSize: 28 }}>{avg.toLocaleString('fr-FR')}</div>
            }
          </div>

          {/* Top salle */}
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Salle leader</span>
            {loading
              ? <div className="skeleton" style={{ height: 28, width: 140 }} />
              : topGym
                ? <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                      {topGym.nom}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--fg3)', marginTop: -4 }}>
                      <Users size={10} />
                      <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{topGym.nbAdherents}</span> membres
                    </div>
                  </>
                : <span style={{ color: 'var(--fg3)' }}>—</span>
            }
          </div>
        </div>

        {/* ── Tableau ────────────────────────────────────── */}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucune donnée" subtitle="Aucune salle enregistrée pour l'instant" />
        ) : (
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
                  placeholder="Rechercher une salle…"
                  aria-label="Rechercher"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }}
                />
              </div>
              {search && (
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  <span className="num">{filtered.length}</span> résultat{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 120px 120px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: 10, width: 20 }} />
                    <div className="skeleton" style={{ height: 11, width: 160 }} />
                    <div className="skeleton" style={{ height: 10, width: 100 }} />
                    <div className="skeleton" style={{ height: 10, width: 60 }} />
                    <div className="skeleton" style={{ height: 10, width: 80 }} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th><SortBtn k="nom" label="Salle" /></th>
                    <th>Localisation</th>
                    <th style={{ textAlign: 'right' }}><SortBtn k="nbAdherents" label="Membres" /></th>
                    <th style={{ width: 160 }}>Répartition</th>
                    <th style={{ textAlign: 'right' }}><SortBtn k="revenuMois" label="Rev. mois" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const pct = maxCount > 0 ? (r.nbAdherents / maxCount) * 100 : 0;
                    const isTop = i === 0 && sortKey === 'nbAdherents' && sortDir === 'desc';
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="num" style={{ fontSize: 11, fontWeight: 800, color: isTop ? 'var(--accent)' : 'var(--fg3)' }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td>
                          <Link href={`/gyms/${r.slug}`} style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--fg)',
                            textDecoration: 'none', transition: 'color 0.15s',
                          }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg)')}
                          >
                            {r.nom}
                          </Link>
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg3)' }}>
                            <MapPin size={10} strokeWidth={2} />
                            {r.ville}, {r.pays}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 14, fontWeight: 700, color: isTop ? 'var(--accent)' : 'var(--fg)' }}>
                            {r.nbAdherents.toLocaleString('fr-FR')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct}%`, borderRadius: 3,
                                background: isTop
                                  ? 'linear-gradient(90deg, var(--accent), #d4ff6e)'
                                  : 'var(--border3)',
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span className="num" style={{ fontSize: 10, color: 'var(--fg3)', width: 30, textAlign: 'right', flexShrink: 0 }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <TrendingUp size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                              {fmtFcfa(r.revenuMois)}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {!loading && filtered.length === 0 && search && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucune salle ne correspond à « {search} »
              </div>
            )}
          </div>
        )}

      </div>
    </Shell>
  );
}
