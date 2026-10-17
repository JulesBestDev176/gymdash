'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, Building2, CreditCard, Footprints, RefreshCw, TrendingUp, UserPlus, Users } from 'lucide-react';
import Shell from '@/components/shell';
import { AnalyticsCharts } from '@/components/dashboard/analytics-charts';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type { DashboardAnalytics, DashboardPeriod } from '@/lib/dashboard-analytics';
import './dashboard.css';

const number = new Intl.NumberFormat('fr-FR');
const periods: { value: DashboardPeriod; label: string }[] = [
  { value: '30d', label: '30 jours' }, { value: '90d', label: '90 jours' }, { value: '6m', label: '6 mois' },
];
export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('6m');
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  function reload(nextPeriod?: DashboardPeriod) {
    if (nextPeriod === period) return;
    setLoading(true); setError(''); setData(null);
    if (nextPeriod) setPeriod(nextPeriod);
    else setRevision(value => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    authenticatedFetch(`/api/dashboard/analytics?period=${period}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Impossible de charger les statistiques.');
        if (body.period !== period || !body.totals || !Array.isArray(body.series)) throw new Error('Les statistiques reçues sont incomplètes.');
        if (!controller.signal.aborted) setData(body);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Impossible de charger les statistiques.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, revision]);
  const cards = [
    { label: 'Revenus', value: data ? `${number.format(data.totals.revenue)} FCFA` : null, note: 'Sur la période', icon: TrendingUp },
    { label: 'Paiements', value: data && number.format(data.totals.payments), note: 'Sur la période', icon: CreditCard },
    { label: 'Inscriptions', value: data && number.format(data.totals.newMembers), note: 'Nouveaux adhérents sur la période', icon: UserPlus },
    { label: 'Fréquentation', value: data && number.format(data.totals.entries), note: 'Entrées sur la période', icon: Footprints },
    { label: 'Adhérents', value: data && number.format(data.totals.members), note: 'Effectif actuel du réseau', icon: Users },
    { label: 'Salles actives', value: data && number.format(data.totals.activeGyms), note: 'Situation actuelle', icon: Building2 },
  ];
  return <Shell><div className="fade-up dashboard-overview" aria-busy={loading}>
    <header className="dashboard-overview-header">
      <div><span className="section-label">Vue d’ensemble du réseau</span><h1>Dashboard</h1><p>{data ? data.range.label : 'Revenus, adhérents et activité de vos salles'}</p></div>
      <div className="dashboard-overview-controls"><div className="dashboard-periods" role="group" aria-label="Période des statistiques">
        {periods.map(item => <button type="button" key={item.value} aria-pressed={period === item.value} onClick={() => reload(item.value)}>{item.label}</button>)}
      </div><button type="button" className="dashboard-refresh" onClick={() => reload()} disabled={loading} aria-label="Actualiser les statistiques"><RefreshCw size={16} /></button></div>
    </header>
    {error && <div className="card dashboard-overview-error" role="alert"><AlertCircle size={19} /><span>{error}</span><button type="button" onClick={() => reload()}>Réessayer</button></div>}
    {!error && <><div className="dashboard-overview-kpis">
      {cards.map(({ label, value, note, icon: Icon }) => <section className="card dashboard-overview-kpi" key={label} aria-label={label}>
        <div><span className="section-label">{label}</span><Icon size={18} /></div>
        {value === null ? <div className="skeleton dashboard-kpi-skeleton" /> : <strong className="num">{value}</strong>}<p>{note}</p>
      </section>)}
    </div>{data ? <AnalyticsCharts data={data} /> : <div className="dashboard-overview-loading" role="status">Chargement des six vues graphiques…</div>}</>}
    {data && <p className="dashboard-updated">Données actualisées le {new Date(data.generatedAt).toLocaleString('fr-FR')}. Les séries suivent la période sélectionnée ; les effectifs et états des adhérents décrivent la situation actuelle.</p>}
  </div></Shell>;
}
