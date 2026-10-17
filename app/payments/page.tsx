'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa } from '@/lib/api';
import { CreditCard, Search, Download, AlertCircle, RefreshCw, TrendingUp, Hash, ReceiptText, Wallet } from 'lucide-react';

interface Payment {
  id: string;
  type: string;
  formule: string;
  montantFcfa: number;
  mode: string;
  reference?: string;
  createdAt: string;
  member: { id: string; nom: string; prenom: string };
  gym: { id: string; nom: string; ville: string };
  user?: { id: string; nom: string; prenom: string };
}

interface Gym { id: string; nom: string; }

const TYPE_META: Record<string, { label: string; cls: string }> = {
  ABONNEMENT:     { label: 'Abonnement',    cls: 'badge badge-accent' },
  SEANCE_UNIQUE:  { label: 'Séance unique', cls: 'badge badge-blue' },
  INSCRIPTION:    { label: 'Inscription',   cls: 'badge badge-warning' },
  RECHARGE_CARTE: { label: 'Recharge',      cls: 'badge badge-purple' },
};

const MODE_LABELS: Record<string, string> = {
  CASH:   'Espèces',
  CARTE:  'Carte bancaire',
  WAVE:   'Wave',
  ORANGE_MONEY: 'Orange Money',
  VIREMENT: 'Virement',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function exportCsv(rows: Payment[]) {
  const header = ['Date', 'Adhérent', 'Salle', 'Type', 'Formule', 'Montant (FCFA)', 'Mode', 'Enregistré par'];
  const lines = rows.map((p) => [
    fmtDate(p.createdAt),
    `${p.member?.prenom} ${p.member?.nom}`,
    p.gym?.nom ?? '',
    TYPE_META[p.type]?.label ?? p.type,
    p.formule,
    p.montantFcfa,
    MODE_LABELS[p.mode] ?? p.mode,
    p.user ? `${p.user.prenom} ${p.user.nom}` : '',
  ]);
  const csv = [header, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `paiements_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 30;

// Generate list of last 12 months: { value: 'YYYY-MM', label: 'mois année' }
function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    });
  }
  return opts;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Filters
  const [search, setSearch]       = useState('');
  const [gymFilter, setGymFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [page, setPage]           = useState(1);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.get('/api/v1/gym/all-payments')
      .then((r) => setPayments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les paiements'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique gyms for filter
  const gyms = useMemo<Gym[]>(() => {
    const seen = new Set<string>();
    const out: Gym[] = [];
    payments.forEach((p) => {
      if (p.gym && !seen.has(p.gym.id)) { seen.add(p.gym.id); out.push(p.gym); }
    });
    return out.sort((a, b) => a.nom.localeCompare(b.nom));
  }, [payments]);

  // Unique modes for filter
  const modes = useMemo(() => {
    const seen = new Set<string>();
    payments.forEach((p) => { if (p.mode) seen.add(p.mode); });
    return Array.from(seen).sort();
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (gymFilter && p.gym?.id !== gymFilter) return false;
      if (typeFilter && p.type !== typeFilter) return false;
      if (modeFilter && p.mode !== modeFilter) return false;
      if (monthFilter) {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key !== monthFilter) return false;
      }
      if (q) {
        const name = `${p.member?.prenom} ${p.member?.nom}`.toLowerCase();
        const gym = (p.gym?.nom ?? '').toLowerCase();
        if (!name.includes(q) && !gym.includes(q) && !p.formule.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [payments, gymFilter, typeFilter, modeFilter, monthFilter, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = !!(search || gymFilter || typeFilter || modeFilter || monthFilter);

  // KPIs
  const revenuTotal    = useMemo(() => filtered.reduce((s, p) => s + p.montantFcfa, 0), [filtered]);
  const revenuAbonnement = useMemo(() => filtered.filter((p) => p.type === 'ABONNEMENT').reduce((s, p) => s + p.montantFcfa, 0), [filtered]);
  const revenuSeance   = useMemo(() => filtered.filter((p) => p.type === 'SEANCE_UNIQUE').reduce((s, p) => s + p.montantFcfa, 0), [filtered]);
  const nbTransactions = filtered.length;

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Paiements</h1>
            <p className="page-sub">Historique consolidé de toutes les salles</p>
          </div>
          {!loading && filtered.length > 0 && (
            <button
              onClick={() => exportCsv(filtered)}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '8px 14px' }}
            >
              <Download size={13} /> Exporter CSV
            </button>
          )}
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

        {/* KPI chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="card-accent" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Revenus {hasFilters ? '(filtrés)' : 'totaux'}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><TrendingUp size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 26, width: 100 }} /> : <div className="stat-value stat-value-accent" style={{ fontSize: 24 }}>{fmtFcfa(revenuTotal)}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Transactions</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(130,100,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8264ff' }}><Hash size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 26, width: 60 }} /> : <div className="stat-value" style={{ fontSize: 24, color: 'var(--fg)' }}>{nbTransactions.toLocaleString('fr-FR')}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Abonnements</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}><ReceiptText size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 26, width: 100 }} /> : <div className="stat-value" style={{ fontSize: 24, color: '#38bdf8' }}>{fmtFcfa(revenuAbonnement)}</div>}
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label">Séances</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(34,217,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}><Wallet size={13} /></span>
            </div>
            {loading ? <div className="skeleton" style={{ height: 26, width: 100 }} /> : <div className="stat-value" style={{ fontSize: 24, color: 'var(--success)' }}>{fmtFcfa(revenuSeance)}</div>}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 280 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
            <input
              type="search" className="input-base" placeholder="Recherche adhérent, salle…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 30, fontSize: 12.5 }}
            />
          </div>
          <select className="input-base" style={{ flex: '0 1 160px', fontSize: 12.5 }} value={gymFilter} onChange={(e) => { setGymFilter(e.target.value); setPage(1); }}>
            <option value="">Toutes les salles</option>
            {gyms.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
          </select>
          <select className="input-base" style={{ flex: '0 1 150px', fontSize: 12.5 }} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Tous les types</option>
            <option value="ABONNEMENT">Abonnement</option>
            <option value="SEANCE_UNIQUE">Séance unique</option>
            <option value="INSCRIPTION">Inscription</option>
            <option value="RECHARGE_CARTE">Recharge carte</option>
          </select>
          <select className="input-base" style={{ flex: '0 1 150px', fontSize: 12.5 }} value={modeFilter} onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}>
            <option value="">Tous les modes</option>
            {modes.map((m) => <option key={m} value={m}>{MODE_LABELS[m] ?? m}</option>)}
          </select>
          <select className="input-base" style={{ flex: '0 1 160px', fontSize: 12.5 }} value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}>
            <option value="">Tous les mois</option>
            {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px', color: 'var(--fg3)', whiteSpace: 'nowrap' }}
              onClick={() => { setSearch(''); setGymFilter(''); setTypeFilter(''); setModeFilter(''); setMonthFilter(''); setPage(1); }}
            >
              Réinitialiser
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
            <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{filtered.length.toLocaleString('fr-FR')}</span> résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px 130px 90px 110px 90px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 11, width: j === 0 ? 120 : 80 }} />
                ))}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={hasFilters ? 'Aucun paiement correspondant' : 'Aucun paiement'}
            subtitle={hasFilters ? 'Réinitialisez les filtres pour afficher tous les résultats' : undefined}
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Adhérent</th>
                  <th>Salle</th>
                  <th>Type</th>
                  <th>Formule</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th>Mode</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => {
                  const typeMeta = TYPE_META[p.type];
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {p.member?.prenom} {p.member?.nom}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg2)' }}>{p.gym?.nom}</td>
                      <td>
                        {typeMeta
                          ? <span className={typeMeta.cls} style={{ fontSize: 10 }}>{typeMeta.label}</span>
                          : <span style={{ color: 'var(--fg3)', fontSize: 12 }}>{p.type}</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg2)' }}>{p.formule}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="num" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{fmtFcfa(p.montantFcfa)}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--fg2)' }}>{MODE_LABELS[p.mode] ?? p.mode}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
                  ← Précédent
                </button>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span>
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
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
