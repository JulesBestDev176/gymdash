'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { ListVideo, Search, AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface GymbroProgram {
  id: string; nom: string; description?: string;
  objectif: string; niveauMin: string; niveauMax: string;
  seancesParSemaine: number; nbSemaines: number; actif: boolean; createdAt: string;
}

const OBJECTIF_LABELS: Record<string, string> = {
  PRISE_DE_MASSE:  'Prise de masse',
  FORCE:           'Force',
  REMISE_EN_FORME: 'Remise en forme',
  AUTRE:           'Autre',
};

const NIVEAU_LABELS: Record<string, string> = {
  DEBUTANT:      'Débutant',
  QUELQUES_MOIS: 'Quelques mois',
  PLUS_D_UN_AN:  'Plus d\'1 an',
  INTERMEDIAIRE: 'Intermédiaire',
};

const PAGE_SIZE = 25;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GymbroProgrammesPage() {
  const [programs, setPrograms] = useState<GymbroProgram[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gymbro/programs')
      .then((r) => setPrograms(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((p) =>
      p.nom.toLowerCase().includes(q) ||
      (OBJECTIF_LABELS[p.objectif] ?? p.objectif).toLowerCase().includes(q)
    );
  }, [programs, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const nbActifs   = useMemo(() => programs.filter((p) => p.actif).length, [programs]);
  const nbInactifs = programs.length - nbActifs;

  async function toggleProgram(p: GymbroProgram) {
    setTogglingId(p.id);
    try {
      await adminApi.patch(`/api/v1/gymbro/programs/${p.id}/toggle`);
      setPrograms((prev) => prev.map((x) => x.id === p.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 className="page-title">Programmes GymBro</h1>
          <p className="page-sub">Plans d'entraînement disponibles dans l'application</p>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Total</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><ListVideo size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>{programs.length}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Actifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--success)' }}>{nbActifs}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Inactifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--fg3)' }}>{nbInactifs}</div>}
          </div>
        </div>

        {!loading && !error && programs.length === 0 ? (
          <EmptyState icon={ListVideo} title="Aucun programme" subtitle="Les programmes créés dans GymBro apparaîtront ici" />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
                <input type="search" className="input-base" placeholder="Nom, objectif…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }} />
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span> programme{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 120px 160px 80px 90px 80px 90px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <div key={j} className="skeleton" style={{ height: 11, width: j === 1 ? 140 : 70 }} />
                    ))}
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucun programme ne correspond à la recherche
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Nom</th>
                    <th>Objectif</th>
                    <th>Niveau</th>
                    <th>Durée</th>
                    <th>Séances/sem</th>
                    <th>Statut</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--fg3)', fontSize: 12 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td style={{ fontSize: 13, color: 'var(--fg2)' }}>{OBJECTIF_LABELS[p.objectif] ?? p.objectif}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg2)' }}>
                        {NIVEAU_LABELS[p.niveauMin] ?? p.niveauMin}
                        {p.niveauMax && p.niveauMax !== p.niveauMin && (
                          <span style={{ color: 'var(--fg3)' }}> → {NIVEAU_LABELS[p.niveauMax] ?? p.niveauMax}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--fg2)' }}>{p.nbSemaines} sem.</td>
                      <td style={{ fontSize: 13, color: 'var(--fg2)', textAlign: 'center' }}>{p.seancesParSemaine}×</td>
                      <td>
                        <span className={p.actif ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: 10 }}>
                          {p.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleProgram(p)}
                          disabled={togglingId === p.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                            background: p.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                            color: p.actif ? 'var(--danger)' : 'var(--success)',
                            transition: 'opacity 0.15s',
                            opacity: togglingId === p.id ? 0.5 : 1,
                          }}
                        >
                          {togglingId === p.id ? <Spinner size="sm" /> : p.actif ? <XCircle size={12} /> : <CheckCircle size={12} />}
                          {p.actif ? 'Désactiver' : 'Activer'}
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
