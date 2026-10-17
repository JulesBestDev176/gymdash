'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { Dumbbell, Search, AlertCircle, RefreshCw, CheckCircle, XCircle, Plus, X } from 'lucide-react';

interface GymbroExercise {
  id: string; nomFr: string; descriptionFr?: string;
  groupeMusculaire: string; equipementRequis: string;
  difficulte?: string; actif: boolean; createdAt: string;
}

interface CreateExerciseForm {
  nomFr: string;
  groupeMusculaire: string;
  equipementRequis: string;
  difficulte: string;
  descriptionFr: string;
}

const FORM_EMPTY: CreateExerciseForm = {
  nomFr: '', groupeMusculaire: '', equipementRequis: '', difficulte: '', descriptionFr: '',
};

const GROUPES = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Abdominaux', 'Obliques', 'Quadriceps', 'Ischio-jambiers', 'Fessiers',
  'Mollets', 'Cardio', 'Plein corps',
];
const EQUIPEMENTS = [
  'Aucun (poids de corps)', 'Haltères', 'Barre', 'Kettlebell', 'Câbles',
  'Machine guidée', 'Élastique', 'TRX', 'Banc', 'Poulie haute',
];
const DIFFICULTES = ['Débutant', 'Intermédiaire', 'Avancé'];

function difficulteBadge(d?: string) {
  if (!d) return null;
  const val = d.toLowerCase();
  if (val.includes('débutant') || val === 'debutant')           return 'badge badge-success';
  if (val.includes('intermédiaire') || val === 'intermediaire') return 'badge badge-warning';
  if (val.includes('avancé') || val === 'avance')               return 'badge badge-danger';
  return 'badge badge-neutral';
}

const PAGE_SIZE = 25;

export default function GymbroExercicesPage() {
  const [exercises, setExercises] = useState<GymbroExercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Creation form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<CreateExerciseForm>(FORM_EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gymbro/exercises/admin/all')
      .then((r) => setExercises(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) =>
      e.nomFr.toLowerCase().includes(q) ||
      e.groupeMusculaire.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const nbActifs = useMemo(() => exercises.filter((e) => e.actif).length, [exercises]);

  async function toggleExercise(e: GymbroExercise) {
    setTogglingId(e.id);
    try {
      await adminApi.patch(`/api/v1/gymbro/exercises/admin/${e.id}/toggle`);
      setExercises((prev) => prev.map((x) => x.id === e.id ? { ...x, actif: !x.actif } : x));
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  function openForm() { setForm(FORM_EMPTY); setFormError(''); setShowForm(true); }
  function closeForm() { if (!saving) { setShowForm(false); setFormError(''); } }

  async function submitForm() {
    if (!form.nomFr.trim()) { setFormError('Le nom est obligatoire.'); return; }
    if (!form.groupeMusculaire) { setFormError('Le groupe musculaire est obligatoire.'); return; }
    if (!form.equipementRequis) { setFormError('L\'équipement est obligatoire.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: any = {
        nomFr: form.nomFr.trim(),
        groupeMusculaire: form.groupeMusculaire,
        equipementRequis: form.equipementRequis,
        musclesPrimairesJson: JSON.stringify([form.groupeMusculaire]),
      };
      if (form.difficulte)   payload.difficulte = form.difficulte;
      if (form.descriptionFr.trim()) payload.descriptionFr = form.descriptionFr.trim();
      const res = await adminApi.post('/api/v1/gymbro/exercises/admin', payload);
      setExercises((prev) => [res.data, ...prev]);
      setShowForm(false);
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 className="page-title">Exercices GymBro</h1>
            <p className="page-sub">Bibliothèque d'exercices de l'application</p>
          </div>
          <button onClick={openForm} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '9px 16px', whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Nouvel exercice
          </button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 360 }}>
          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Total</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><Dumbbell size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 28, width: 60 }} /> : <div className="stat-value stat-value-accent" style={{ fontSize: 28 }}>{exercises.length}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Actifs</span>
            {loading ? <div className="skeleton" style={{ height: 28, width: 50 }} /> : <div className="stat-value" style={{ fontSize: 28, color: 'var(--success)' }}>{nbActifs}</div>}
          </div>
        </div>

        {!loading && !error && exercises.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Aucun exercice" subtitle="Créez le premier exercice de la bibliothèque" action={
            <button onClick={openForm} className="btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <Plus size={14} /> Nouvel exercice
            </button>
          } />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
                <input type="search" className="input-base" placeholder="Nom, groupe musculaire…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)' }} />
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span> exercice{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 140px 140px 90px 70px 110px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div key={j} className="skeleton" style={{ height: 11, width: j === 1 ? 150 : 80 }} />
                    ))}
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                Aucun exercice ne correspond à la recherche
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Exercice</th>
                    <th>Groupe musculaire</th>
                    <th>Équipement</th>
                    <th>Difficulté</th>
                    <th>Statut</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e, i) => {
                    const diffCls = difficulteBadge(e.difficulte);
                    return (
                      <tr key={e.id}>
                        <td style={{ color: 'var(--fg3)', fontSize: 12 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{e.nomFr}</td>
                        <td style={{ fontSize: 13, color: 'var(--fg2)' }}>{e.groupeMusculaire}</td>
                        <td style={{ fontSize: 13, color: 'var(--fg2)' }}>{e.equipementRequis}</td>
                        <td>
                          {e.difficulte && diffCls
                            ? <span className={diffCls} style={{ fontSize: 10 }}>{e.difficulte}</span>
                            : <span style={{ color: 'var(--fg3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <span className={e.actif ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: 10 }}>
                            {e.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleExercise(e)}
                            disabled={togglingId === e.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                              background: e.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                              color: e.actif ? 'var(--danger)' : 'var(--success)',
                              opacity: togglingId === e.id ? 0.5 : 1,
                            }}
                          >
                            {togglingId === e.id ? <Spinner size="sm" /> : e.actif ? <XCircle size={12} /> : <CheckCircle size={12} />}
                            {e.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {totalPages > 1 && !loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>← Précédent</button>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span></span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>Suivant →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Creation modal ── */}
      {showForm && (
        <div
          role="dialog" aria-modal="true" aria-label="Nouvel exercice"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border2)',
            borderRadius: 16, width: '100%', maxWidth: 520,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.18s ease both',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Dumbbell size={15} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>Nouvel exercice</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 1 }}>Ajouter à la bibliothèque GymBro</div>
                </div>
              </div>
              <button onClick={closeForm} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 6, borderRadius: 7, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={13} />{formError}
                </div>
              )}

              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  Nom de l'exercice <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  className="input-base" placeholder="ex : Développé couché barre"
                  value={form.nomFr} onChange={(e) => setForm((f) => ({ ...f, nomFr: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                    Groupe musculaire <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="input-base" style={{ width: '100%' }} value={form.groupeMusculaire} onChange={(e) => setForm((f) => ({ ...f, groupeMusculaire: e.target.value }))}>
                    <option value="">Sélectionner…</option>
                    {GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                    Équipement <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="input-base" style={{ width: '100%' }} value={form.equipementRequis} onChange={(e) => setForm((f) => ({ ...f, equipementRequis: e.target.value }))}>
                    <option value="">Sélectionner…</option>
                    {EQUIPEMENTS.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Difficulté</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIFFICULTES.map((d) => (
                    <button
                      key={d} type="button"
                      onClick={() => setForm((f) => ({ ...f, difficulte: f.difficulte === d ? '' : d }))}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: form.difficulte === d ? '1px solid var(--accent)' : '1px solid var(--border2)',
                        background: form.difficulte === d ? 'var(--accent-dim)' : 'var(--bg2)',
                        color: form.difficulte === d ? 'var(--accent)' : 'var(--fg2)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Description (optionnel)</label>
                <textarea
                  className="input-base" placeholder="Instructions d'exécution, conseils…"
                  rows={3} value={form.descriptionFr} onChange={(e) => setForm((f) => ({ ...f, descriptionFr: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
              <button onClick={closeForm} disabled={saving} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Annuler</button>
              <button onClick={submitForm} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 7 }}>
                {saving ? <><Spinner size="sm" /> Création…</> : <><Plus size={13} /> Créer l'exercice</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
