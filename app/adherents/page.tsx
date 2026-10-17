'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import { adminApi, fmtFcfa, Gym, GymStatut } from '@/lib/api';
import {
  Users, AlertCircle, RefreshCw, Search,
  ArrowUp, ArrowDown, ArrowUpDown, MapPin, Globe,
  TrendingUp, Download,
} from 'lucide-react';

/* ── types ─────────────────────────────────────────────── */
interface GymRow {
  id: string; slug: string; nom: string; ville: string; pays: string;
  statut: GymStatut;
  nbAdherents: number; revenuMois: number;
}

type SortKey = 'nom' | 'nbAdherents' | 'revenuMois';
type SortDir = 'asc' | 'desc';

const STATUT_TABS: { key: GymStatut | ''; label: string }[] = [
  { key: '',          label: 'Toutes' },
  { key: 'ACTIF',     label: 'Actives' },
  { key: 'INACTIF',   label: 'Inactives' },
  { key: 'SUSPENDU',  label: 'Suspendues' },
];

const MEDAL_COLOR: Record<number, string> = {
  0: '#ffd700',
  1: '#c0c0c0',
  2: '#cd7f32',
};

/* ── helpers ───────────────────────────────────────────── */
function gymStatut(g: Gym): GymStatut { return g.statut ?? 'ACTIF'; }

function exportCsv(rows: GymRow[]) {
  const header = 'Rang,Salle,Ville,Pays,Statut,Membres,Revenu Mois (FCFA)';
  const lines = rows.map((r, i) =>
    [i + 1, `"${r.nom}"`, r.ville, r.pays, r.statut, r.nbAdherents, r.revenuMois].join(',')
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'adherents.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ── page ───────────────────────────────────────────────── */
export default function AdherentsPage() {
  const [rows, setRows]                 = useState<GymRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [filterStatut, setFilterStatut] = useState<GymStatut | ''>('');
  const [filterPays, setFilterPays]     = useState('');
  const [sortKey, setSortKey]           = useState<SortKey>('nbAdherents');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi.get('/api/v1/gym/all')
      .then((r) => {
        const data: Gym[] = Array.isArray(r.data) ? r.data : [];
        setRows(data.map((g) => ({
          id: g.id, slug: g.slug, nom: g.nom, ville: g.ville, pays: g.pays,
          statut:      gymStatut(g),
          nbAdherents: g.nbAdherents ?? 0,
          revenuMois:  g.revenuMois  ?? 0,
        })));
      })
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* unique countries */
  const paysList = useMemo(() =>
    [...new Set(rows.map((r) => r.pays))].filter(Boolean).sort(),
    [rows]
  );

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'nom' ? 'asc' : 'desc'); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (filterStatut) list = list.filter((r) => r.statut === filterStatut);
    if (filterPays)   list = list.filter((r) => r.pays === filterPays);
    if (q)            list = list.filter((r) =>
      r.nom.toLowerCase().includes(q) || r.ville.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const va = sortKey === 'nom' ? a.nom : a[sortKey];
      const vb = sortKey === 'nom' ? b.nom : b[sortKey];
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, search, filterStatut, filterPays, sortKey, sortDir]);

  /* global stats (always from full rows) */
  const totalMembers = rows.reduce((s, r) => s + r.nbAdherents, 0);
  const totalRevenu  = rows.reduce((s, r) => s + r.revenuMois, 0);
  const topGym       = rows.length ? [...rows].sort((a, b) => b.nbAdherents - a.nbAdherents)[0] : null;
  const avg          = rows.length ? Math.round(totalMembers / rows.length) : 0;

  /* statut tab counts */
  const statutCounts = useMemo(() => {
    const map: Record<string, number> = { '': rows.length };
    for (const r of rows) map[r.statut] = (map[r.statut] ?? 0) + 1;
    return map;
  }, [rows]);

  const hasActiveFilters = filterStatut !== '' || filterPays !== '' || search.trim() !== '';

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 className="page-title">Adhérents</h1>
            <p className="page-sub">Répartition des membres par salle</p>
          </div>
          {!loading && rows.length > 0 && (
            <button
              onClick={() => exportCsv(filtered)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: 'var(--card2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--fg2)',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--border3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
            >
              <Download size={12} /> Exporter CSV
            </button>
          )}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

          {/* Total adhérents */}
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
                  {totalMembers.toLocaleString('fr-FR')}
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

          {/* Salle leader */}
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

          {/* Revenu total */}
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Revenu total / mois</span>
              <TrendingUp size={12} style={{ color: 'var(--fg3)' }} />
            </div>
            {loading
              ? <div className="skeleton" style={{ height: 24, width: 120 }} />
              : <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)', letterSpacing: '-0.01em' }}>
                  {fmtFcfa(totalRevenu)}
                </div>
            }
          </div>
        </div>

        {/* ── Tableau ────────────────────────────────────── */}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucune donnée" subtitle="Aucune salle enregistrée pour l'instant" />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>

            {/* Toolbar row 1: search + pays + count */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
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

              {/* Pays filter — only shown when multiple countries exist */}
              {paysList.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <Globe size={11} style={{
                    position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg3)', pointerEvents: 'none',
                  }} />
                  <select
                    value={filterPays}
                    onChange={(e) => setFilterPays(e.target.value)}
                    className="input-base"
                    style={{
                      paddingLeft: 28, paddingRight: 20, fontSize: 12.5,
                      background: 'var(--bg2)', border: '1px solid var(--border2)',
                      appearance: 'none', cursor: 'pointer',
                      color: filterPays ? 'var(--fg)' : 'var(--fg3)',
                      minWidth: 130,
                    }}
                  >
                    <option value="">Tous les pays</option>
                    {paysList.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearch(''); setFilterStatut(''); setFilterPays(''); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11.5, color: 'var(--fg3)', padding: '2px 0',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
                  >
                    × Réinitialiser
                  </button>
                )}
                <span style={{ fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                  <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span>
                  {' '}salle{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Toolbar row 2: statut tabs */}
            <div style={{
              display: 'flex', gap: 0, overflowX: 'auto',
              borderBottom: '1px solid var(--border)',
              padding: '0 16px',
            }}>
              {STATUT_TABS.map(({ key, label }) => {
                const count = statutCounts[key] ?? 0;
                const active = filterStatut === key;
                return (
                  <button
                    key={key || 'all'}
                    onClick={() => setFilterStatut(key)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '9px 12px', fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--fg)' : 'var(--fg3)',
                      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'color 0.15s',
                      whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}
                  >
                    {label}
                    {!loading && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 99,
                        background: active ? 'var(--accent-dim)' : 'var(--border)',
                        color: active ? 'var(--accent)' : 'var(--fg3)',
                        padding: '1px 6px', minWidth: 18, textAlign: 'center',
                      }}>
                        {count}
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
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 140px 100px 150px 140px',
                    gap: 16, padding: '14px 20px',
                    borderBottom: '1px solid var(--border)', alignItems: 'center',
                  }}>
                    <div className="skeleton" style={{ height: 10, width: 24 }} />
                    <div className="skeleton" style={{ height: 11, width: 160 }} />
                    <div className="skeleton" style={{ height: 10, width: 100 }} />
                    <div className="skeleton" style={{ height: 10, width: 50 }} />
                    <div className="skeleton" style={{ height: 6, width: 110 }} />
                    <div className="skeleton" style={{ height: 10, width: 90 }} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th><SortBtn k="nom" label="Salle" /></th>
                    <th>Localisation</th>
                    <th style={{ textAlign: 'right' }}><SortBtn k="nbAdherents" label="Membres" /></th>
                    <th style={{ width: 160 }}>Part du total</th>
                    <th style={{ textAlign: 'right' }}><SortBtn k="revenuMois" label="Rev. / mois" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const pct = totalMembers > 0 ? (r.nbAdherents / totalMembers) * 100 : 0;
                    const isMemberRank = sortKey === 'nbAdherents' && sortDir === 'desc';
                    const medalColor = isMemberRank ? MEDAL_COLOR[i] : undefined;
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="num" style={{
                            fontSize: 11, fontWeight: 800,
                            color: medalColor ?? 'var(--fg3)',
                          }}>
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
                          <span className="num" style={{
                            fontSize: 14, fontWeight: 700,
                            color: medalColor ?? 'var(--fg)',
                          }}>
                            {r.nbAdherents.toLocaleString('fr-FR')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct}%`, borderRadius: 3,
                                background: medalColor === MEDAL_COLOR[0]
                                  ? 'linear-gradient(90deg, var(--accent), #d4ff6e)'
                                  : 'var(--border3)',
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span className="num" style={{ fontSize: 10, color: 'var(--fg3)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg2)' }}>
                            {fmtFcfa(r.revenuMois)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                {search
                  ? <>Aucune salle ne correspond à «&nbsp;<strong style={{ color: 'var(--fg2)' }}>{search}</strong>&nbsp;»</>
                  : 'Aucune salle ne correspond aux filtres sélectionnés'
                }
              </div>
            )}
          </div>
        )}

      </div>
    </Shell>
  );
}
