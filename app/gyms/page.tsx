'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa, Gym, GymStatut } from '@/lib/api';
import {
  Plus, Building2, Users, MapPin,
  Search, AlertCircle, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown,
  LayoutGrid, List, ChevronRight,
  TrendingUp, Banknote, CheckCircle2, X,
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────── */
function fmtShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000)     return Math.round(n / 1_000) + 'k';
  return String(n);
}

const STATUT_META: Record<GymStatut, { label: string; cls: string }> = {
  ACTIF:    { label: 'Actif',    cls: 'badge badge-success' },
  INACTIF:  { label: 'Inactif',  cls: 'badge badge-neutral' },
  SUSPENDU: { label: 'Suspendu', cls: 'badge badge-danger'  },
};

type SortKey = 'nom' | 'revenuMois' | 'nbAdherents';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

/* ── modal nouvelle salle ─────────────────────────────── */
interface GymForm {
  nom: string; slug: string; ville: string; pays: string;
}
const GYM_INIT: GymForm = { nom: '', slug: '', ville: '', pays: 'Sénégal' };

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function NewGymModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Gym) => void }) {
  const [form, setForm]     = useState<GymForm>(GYM_INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(k: keyof GymForm, v: string | number) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'nom' && typeof v === 'string') next.slug = toSlug(v);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.post('/api/v1/gym', form);
      onCreated(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={id} className="section-label">{label}</label>
        {children}
      </div>
    );
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Nouvelle salle"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--card)', border: '1px solid var(--border2)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'fadeUp 0.18s ease both',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              Nouvelle salle
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>
              Ajouter une salle au réseau GymPass
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg3)', transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body scrollable */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field id="g-nom" label="Nom de la salle">
              <input ref={firstRef} id="g-nom" required className="input-base"
                placeholder="Gym Central Dakar"
                value={form.nom} onChange={(e) => set('nom', e.target.value)} />
            </Field>
            <Field id="g-slug" label="Identifiant URL (slug)">
              <input id="g-slug" required className="input-base num"
                placeholder="gym-central-dakar"
                value={form.slug} onChange={(e) => set('slug', e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field id="g-ville" label="Ville">
                <input id="g-ville" required className="input-base"
                  placeholder="Dakar"
                  value={form.ville} onChange={(e) => set('ville', e.target.value)} />
              </Field>
              <Field id="g-pays" label="Pays">
                <input id="g-pays" className="input-base"
                  value={form.pays} onChange={(e) => set('pays', e.target.value)} />
              </Field>
            </div>
            {error && (
              <div className="banner-error" role="alert">
                <AlertCircle size={14} />{error}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div style={{
            display: 'flex', gap: 10, padding: '14px 20px',
            borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading && <Spinner size="sm" label="Création en cours" />}
              {loading ? 'Création…' : 'Créer la salle'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── component ────────────────────────────────────────── */
export default function GymsPage() {
  const [gyms, setGyms]           = useState<Gym[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [filterStatut, setFilter] = useState<GymStatut | ''>('');
  const [sortKey, setSortKey]     = useState<SortKey>('nom');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');
  const [viewMode, setViewMode]   = useState<ViewMode>('grid');
  const [showNewGym, setShowNewGym] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    adminApi.get('/api/v1/gym/all')
      .then((r) => setGyms(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les salles'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  /* ── derived stats ──────────────────────────────────── */
  /* statut peut être undefined si la migration n'a pas encore tourné → fallback ACTIF */
  const gymStatut = (g: Gym): GymStatut => g.statut ?? 'ACTIF';

  const stats = useMemo(() => ({
    total:    gyms.length,
    actives:  gyms.filter((g) => gymStatut(g) === 'ACTIF').length,
    membres:  gyms.reduce((s, g) => s + (g.nbAdherents ?? 0), 0),
    revenu:   gyms.reduce((s, g) => s + (g.revenuMois  ?? 0), 0),
  }), [gyms]);

  /* ── filter counts for tabs ─────────────────────────── */
  const counts = useMemo(() => ({
    '':         gyms.length,
    ACTIF:      gyms.filter((g) => gymStatut(g) === 'ACTIF').length,
    INACTIF:    gyms.filter((g) => gymStatut(g) === 'INACTIF').length,
    SUSPENDU:   gyms.filter((g) => gymStatut(g) === 'SUSPENDU').length,
  }), [gyms]);

  /* ── filtered + sorted list ─────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = gyms.filter((g) => {
      if (filterStatut && gymStatut(g) !== filterStatut) return false;
      if (!q) return true;
      return (
        g.nom.toLowerCase().includes(q) ||
        g.ville.toLowerCase().includes(q) ||
        g.pays.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const va: number | string = sortKey === 'nom' ? a.nom : sortKey === 'revenuMois' ? (a.revenuMois ?? 0) : (a.nbAdherents ?? 0);
      const vb: number | string = sortKey === 'nom' ? b.nom : sortKey === 'revenuMois' ? (b.revenuMois ?? 0) : (b.nbAdherents ?? 0);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [gyms, search, filterStatut, sortKey, sortDir]);

  /* ── sub-components ──────────────────────────────────── */
  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`tab-item${active ? ' active' : ''}`}
        style={{ fontSize: 11.5, gap: 5 }}
      >
        <Icon size={10} />
        {label}
      </button>
    );
  }

  const STATUT_TABS: { value: GymStatut | ''; label: string }[] = [
    { value: '',         label: 'Toutes'   },
    { value: 'ACTIF',    label: 'Actif'    },
    { value: 'INACTIF',  label: 'Inactif'  },
    { value: 'SUSPENDU', label: 'Suspendu' },
  ];

  return (
    <Shell>
      {showNewGym && (
        <NewGymModal
          onClose={() => setShowNewGym(false)}
          onCreated={(g) => { setGyms((prev) => [g, ...prev]); setShowNewGym(false); }}
        />
      )}
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ══ HEADER ══════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">Salles de sport</h1>
            <p className="page-sub">
              {loading
                ? <span style={{ opacity: 0.4 }}>Chargement…</span>
                : <><span className="num">{gyms.length}</span> salle{gyms.length !== 1 ? 's' : ''} enregistrée{gyms.length !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
          <button className="btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowNewGym(true)}>
            <Plus size={14} />
            Nouvelle salle
          </button>
        </div>

        {/* ══ ERROR BANNER ════════════════════════════════ */}
        {error && (
          <div
            role="alert"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px', borderRadius: 10,
              background: 'rgba(255,68,85,0.08)',
              border: '1px solid rgba(255,68,85,0.22)',
              color: 'var(--danger)', fontSize: 13,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--fg)' }}>{error}</span>
            <button
              onClick={load}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, padding: '4px 8px',
                borderRadius: 6, transition: 'opacity .15s',
              }}
            >
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {/* ══ SUMMARY STATS ROW ════════════════════════════ */}
        {!loading && !error && gyms.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}>
            {/* Stat chip: Total salles */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Building2 size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 3 }}>Total salles</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', lineHeight: 1 }}>
                  {stats.total}
                </div>
              </div>
            </div>

            {/* Stat chip: Actives */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'rgba(34,217,110,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 3 }}>Actives</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', lineHeight: 1 }}>
                  {stats.actives}
                </div>
              </div>
            </div>

            {/* Stat chip: Total membres */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'rgba(91,156,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Users size={15} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 3 }}>Total membres</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', lineHeight: 1 }}>
                  {fmtShort(stats.membres)}
                </div>
              </div>
            </div>

            {/* Stat chip: Revenu mensuel */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Banknote size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 3 }}>Revenu / mois</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, lineHeight: 1 }}>
                  <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                    {fmtShort(stats.revenu)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 500 }}>FCFA</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ SKELETON STATS ══════════════════════════════ */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--card)', border: '1px solid var(--border)',
              }}>
                <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 8, width: 60 }} />
                  <div className="skeleton" style={{ height: 18, width: 40 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ TOOLBAR ══════════════════════════════════════ */}
        {!loading && !error && gyms.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Row 1 — search + sort + view */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
            }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <Search size={13} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fg3)', pointerEvents: 'none',
                }} />
                <input
                  type="search"
                  className="input-base"
                  placeholder="Rechercher…"
                  aria-label="Rechercher une salle"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    paddingLeft: 32, fontSize: 13,
                    background: 'var(--bg2)', border: '1px solid var(--border2)',
                  }}
                />
              </div>

              {/* Separator */}
              <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />

              {/* Sort buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SortBtn k="nom" label="Nom" />
                <SortBtn k="nbAdherents" label="Membres" />
                <SortBtn k="revenuMois" label="Revenu" />
              </div>

              {/* Separator */}
              <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />

              {/* View toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {([['grid', LayoutGrid, 'Vue grille'], ['list', List, 'Vue liste']] as const).map(([mode, Icon, lbl]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={lbl}
                    aria-pressed={viewMode === mode}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: viewMode === mode ? 'var(--border2)' : 'transparent',
                      color: viewMode === mode ? 'var(--fg)' : 'var(--fg3)',
                      transition: 'all .15s',
                    }}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>

              {/* Result count */}
              {(search || filterStatut) && (
                <span style={{ fontSize: 11.5, color: 'var(--fg3)', whiteSpace: 'nowrap', marginLeft: 4 }}>
                  <span className="num" style={{ color: 'var(--fg2)' }}>{filtered.length}</span> résultat{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Row 2 — status filter tabs */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 2 }}>
              {STATUT_TABS.map(({ value, label }) => {
                const active = filterStatut === value;
                const count = counts[value as keyof typeof counts] ?? 0;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value as GymStatut | '')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 7,
                      border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: active ? 600 : 400,
                      background: active ? 'var(--border2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--fg3)',
                      transition: 'all .15s',
                    }}
                  >
                    {label}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 18, height: 16, padding: '0 5px', borderRadius: 99,
                      fontSize: 10, fontWeight: 700, lineHeight: 1,
                      background: active ? 'rgba(181,255,45,0.15)' : 'var(--card3)',
                      color: active ? 'var(--accent)' : 'var(--fg3)',
                      transition: 'all .15s',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ SKELETON CARDS ══════════════════════════════ */}
        {loading && (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div className="skeleton" style={{ height: 13, width: 140 }} />
                    <div className="skeleton" style={{ height: 10, width: 90 }} />
                  </div>
                  <div className="skeleton" style={{ width: 48, height: 20, borderRadius: 5 }} />
                </div>
                <div className="skeleton" style={{ height: 10, width: 80 }} />
              </div>
            ))}
          </div>
        )}

        {/* ══ EMPTY: no gyms at all ════════════════════════ */}
        {!loading && !error && gyms.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Aucune salle enregistrée"
            subtitle="Créez votre première salle pour commencer"
            action={
              <button className="btn-primary" onClick={() => setShowNewGym(true)}>
                <Plus size={14} /> Nouvelle salle
              </button>
            }
          />
        )}

        {/* ══ EMPTY: filter has no results ════════════════ */}
        {!loading && !error && gyms.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="Aucun résultat"
            subtitle="Essayez d'autres termes ou réinitialisez les filtres"
            action={
              <button className="btn-ghost" onClick={() => { setSearch(''); setFilter(''); }}>
                Réinitialiser les filtres
              </button>
            }
          />
        )}

        {/* ══ GRID VIEW ════════════════════════════════════ */}
        {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {filtered.map((gym) => {
              const meta = STATUT_META[gymStatut(gym)];
              return (
                <Link key={gym.id} href={`/gyms/${gym.slug}`} className="gym-card" style={{ padding: '16px 18px', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gym-card-name">{gym.nom}</div>
                      <div className="gym-card-location" style={{ marginTop: 5 }}>
                        <MapPin size={11} strokeWidth={2} />
                        {gym.ville}, {gym.pays}
                      </div>
                    </div>
                    <span className={meta.cls} style={{ flexShrink: 0 }}>{meta.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--fg3)' }}>
                      <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{gym.nbAdherents ?? 0}</span> membre{(gym.nbAdherents ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--fg3)' }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ══ LIST VIEW ════════════════════════════════════ */}
        {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 90px 90px 100px 36px',
              gap: 0,
              padding: '8px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--card2)',
            }}>
              <span className="section-label">Salle</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Statut</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Membres</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Rev./mois</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Mensualité</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.map((gym, idx) => {
              const meta = STATUT_META[gymStatut(gym)];
              const isLast = idx === filtered.length - 1;
              return (
                <Link
                  key={gym.id}
                  href={`/gyms/${gym.slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 90px 90px 100px 36px',
                    gap: 0,
                    padding: '12px 18px',
                    alignItems: 'center',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    transition: 'background .15s',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Name + location */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--fg)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {gym.nom}
                    </span>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11.5, color: 'var(--fg3)',
                    }}>
                      <MapPin size={10} strokeWidth={2} />
                      {gym.ville}, {gym.pays}
                    </span>
                  </div>

                  {/* Statut */}
                  <div style={{ textAlign: 'right' }}>
                    <span className={meta.cls}>{meta.label}</span>
                  </div>

                  {/* Membres */}
                  <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                    {gym.nbAdherents ?? 0}
                  </div>

                  {/* Rev. mois */}
                  <div style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                      {fmtShort(gym.revenuMois ?? 0)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--fg3)', marginLeft: 2 }}>FCFA</span>
                  </div>

                  {/* Mensualité */}
                  <div style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontSize: 13, color: 'var(--fg2)' }}>
                      {fmtShort(gym.prixMensualite)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--fg3)', marginLeft: 2 }}>FCFA</span>
                  </div>

                  {/* Chevron */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <ChevronRight size={14} style={{ color: 'var(--fg3)' }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </Shell>
  );
}
