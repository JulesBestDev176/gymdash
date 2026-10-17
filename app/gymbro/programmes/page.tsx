'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi } from '@/lib/api';
import { ListVideo, Search, AlertCircle, RefreshCw, CheckCircle, XCircle, Plus, X, ChevronRight } from 'lucide-react';

interface GymbroProgram {
  id: string; nom: string; description?: string;
  objectif: string; niveauMin: string; niveauMax: string;
  seancesParSemaine: number; nbSemaines: number;
  typeEquipement?: string; dureeSeanceMin?: number;
  actif: boolean; createdAt: string;
}

interface CreateProgramForm {
  nom: string;
  description: string;
  objectif: string;
  niveauMin: string;
  niveauMax: string;
  seancesParSemaine: number;
  typeEquipement: string;
  dureeSeanceMin: number;
  nbSemaines: number;
}

const FORM_EMPTY: CreateProgramForm = {
  nom: '', description: '',
  objectif: '', niveauMin: '', niveauMax: '',
  seancesParSemaine: 3, typeEquipement: '',
  dureeSeanceMin: 60, nbSemaines: 8,
};

const OBJECTIFS = [
  { value: 'PRISE_DE_MASSE',  label: 'Prise de masse' },
  { value: 'FORCE',           label: 'Force' },
  { value: 'REMISE_EN_FORME', label: 'Remise en forme' },
  { value: 'AUTRE',           label: 'Autre' },
];
const NIVEAUX = [
  { value: 'DEBUTANT',      label: 'Débutant' },
  { value: 'QUELQUES_MOIS', label: 'Quelques mois' },
  { value: 'PLUS_D_UN_AN',  label: 'Plus d\'1 an' },
  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
];
const EQUIPEMENTS = [
  { value: 'FULL_GYM',          label: 'Salle complète' },
  { value: 'HALTERES_SEULEMENT', label: 'Haltères seulement' },
  { value: 'POIDS_DE_CORPS',    label: 'Poids de corps' },
  { value: 'BARRE_ET_HALTERES', label: 'Barre + haltères' },
];

const OBJECTIF_LABELS: Record<string, string> = Object.fromEntries(OBJECTIFS.map((o) => [o.value, o.label]));
const NIVEAU_LABELS: Record<string, string>   = Object.fromEntries(NIVEAUX.map((n) => [n.value, n.label]));

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

  // Creation form
  const [showForm, setShowForm]   = useState(false);
  const [step, setStep]           = useState(1); // 1 = infos, 2 = paramètres
  const [form, setForm]           = useState<CreateProgramForm>(FORM_EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

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

  function openForm() { setForm(FORM_EMPTY); setFormError(''); setStep(1); setShowForm(true); }
  function closeForm() { if (!saving) { setShowForm(false); setFormError(''); setStep(1); } }

  function nextStep() {
    if (!form.nom.trim()) { setFormError('Le nom du programme est obligatoire.'); return; }
    if (!form.objectif)   { setFormError('L\'objectif est obligatoire.'); return; }
    if (!form.niveauMin)  { setFormError('Le niveau minimum est obligatoire.'); return; }
    if (!form.niveauMax)  { setFormError('Le niveau maximum est obligatoire.'); return; }
    setFormError(''); setStep(2);
  }

  async function submitForm() {
    if (!form.typeEquipement) { setFormError('L\'équipement est obligatoire.'); return; }
    if (form.seancesParSemaine < 2 || form.seancesParSemaine > 6) { setFormError('Séances/sem : entre 2 et 6.'); return; }
    if (form.dureeSeanceMin < 30 || form.dureeSeanceMin > 180) { setFormError('Durée séance : entre 30 et 180 min.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: any = {
        nom: form.nom.trim(),
        objectif: form.objectif,
        niveauMin: form.niveauMin,
        niveauMax: form.niveauMax,
        seancesParSemaine: form.seancesParSemaine,
        typeEquipement: form.typeEquipement,
        dureeSeanceMin: form.dureeSeanceMin,
        nbSemaines: form.nbSemaines,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      const res = await adminApi.post('/api/v1/gymbro/programs', payload);
      setPrograms((prev) => [res.data, ...prev]);
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
            <h1 className="page-title">Programmes GymBro</h1>
            <p className="page-sub">Plans d'entraînement disponibles dans l'application</p>
          </div>
          <button onClick={openForm} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '9px 16px', whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Nouveau programme
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 480 }}>
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
          <EmptyState icon={ListVideo} title="Aucun programme" subtitle="Créez le premier programme d'entraînement">
            <button onClick={openForm} className="btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <Plus size={14} /> Nouveau programme
            </button>
          </EmptyState>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
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
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Aucun programme ne correspond à la recherche</div>
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

      {/* ── Creation modal (2 steps) ── */}
      {showForm && (
        <div
          role="dialog" aria-modal="true" aria-label="Nouveau programme"
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
            borderRadius: 16, width: '100%', maxWidth: 560,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.18s ease both',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <ListVideo size={15} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>Nouveau programme</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 1 }}>
                    Étape <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{step}</span> / 2 — {step === 1 ? 'Informations générales' : 'Paramètres d\'entraînement'}
                  </div>
                </div>
              </div>
              <button onClick={closeForm} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 6, borderRadius: 7, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 0, padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
              {[1, 2].map((s) => (
                <div key={s} style={{
                  flex: 1, height: 3,
                  background: s <= step ? 'var(--accent)' : 'var(--border)',
                  marginRight: s < 2 ? 4 : 0,
                  borderRadius: 3,
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>

            {formError && (
              <div style={{ margin: '16px 22px 0', background: 'var(--danger-dim)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={13} />{formError}
              </div>
            )}

            {/* Step 1 — General info */}
            {step === 1 && (
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                    Nom du programme <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input className="input-base" placeholder="ex : Powerbuilding 8 semaines" value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} style={{ width: '100%' }} />
                </div>

                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
                    Objectif <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {OBJECTIFS.map((o) => (
                      <button key={o.value} type="button"
                        onClick={() => setForm((f) => ({ ...f, objectif: o.value }))}
                        style={{
                          padding: '9px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                          border: form.objectif === o.value ? '1px solid var(--accent)' : '1px solid var(--border2)',
                          background: form.objectif === o.value ? 'var(--accent-dim)' : 'var(--bg2)',
                          color: form.objectif === o.value ? 'var(--accent)' : 'var(--fg2)',
                          transition: 'all 0.12s',
                        }}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                      Niveau min <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select className="input-base" style={{ width: '100%' }} value={form.niveauMin} onChange={(e) => setForm((f) => ({ ...f, niveauMin: e.target.value }))}>
                      <option value="">Sélectionner…</option>
                      {NIVEAUX.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                      Niveau max <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select className="input-base" style={{ width: '100%' }} value={form.niveauMax} onChange={(e) => setForm((f) => ({ ...f, niveauMax: e.target.value }))}>
                      <option value="">Sélectionner…</option>
                      {NIVEAUX.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Description (optionnel)</label>
                  <textarea className="input-base" placeholder="Présentation du programme, objectifs détaillés…"
                    rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>
            )}

            {/* Step 2 — Training params */}
            {step === 2 && (
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 8 }}>
                    Équipement <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {EQUIPEMENTS.map((eq) => (
                      <button key={eq.value} type="button"
                        onClick={() => setForm((f) => ({ ...f, typeEquipement: eq.value }))}
                        style={{
                          padding: '9px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                          border: form.typeEquipement === eq.value ? '1px solid var(--accent)' : '1px solid var(--border2)',
                          background: form.typeEquipement === eq.value ? 'var(--accent-dim)' : 'var(--bg2)',
                          color: form.typeEquipement === eq.value ? 'var(--accent)' : 'var(--fg2)',
                          transition: 'all 0.12s',
                        }}
                      >{eq.label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Séances / semaine</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, seancesParSemaine: Math.max(2, f.seancesParSemaine - 1) }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span className="num" style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 18, color: 'var(--fg)' }}>{form.seancesParSemaine}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, seancesParSemaine: Math.min(6, f.seancesParSemaine + 1) }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Nb semaines</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, nbSemaines: Math.max(1, f.nbSemaines - 1) }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span className="num" style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 18, color: 'var(--fg)' }}>{form.nbSemaines}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, nbSemaines: f.nbSemaines + 1 }))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--fg2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Durée séance (min)</label>
                    <input type="number" className="input-base" min={30} max={180} step={5}
                      value={form.dureeSeanceMin} onChange={(e) => setForm((f) => ({ ...f, dureeSeanceMin: Number(e.target.value) }))}
                      style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5 }}>
                  Les phases, semaines et séances détaillées pourront être ajoutées ultérieurement via l'application mobile ou une mise à jour du dashboard.
                </div>
              </div>
            )}

            {/* Modal footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
              <button onClick={step === 1 ? closeForm : () => { setFormError(''); setStep(1); }} disabled={saving} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
                {step === 1 ? 'Annuler' : '← Retour'}
              </button>
              {step === 1
                ? <button onClick={nextStep} className="btn-primary" style={{ fontSize: 13, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 7 }}>
                    Suivant <ChevronRight size={13} />
                  </button>
                : <button onClick={submitForm} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 7 }}>
                    {saving ? <><Spinner size="sm" /> Création…</> : <><Plus size={13} /> Créer le programme</>}
                  </button>
              }
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
