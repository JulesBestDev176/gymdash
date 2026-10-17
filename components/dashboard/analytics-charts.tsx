'use client';

import { useId, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts';
import { rankGyms, type DashboardAnalytics, type GymMetric } from '@/lib/dashboard-analytics';
import './dashboard-charts.css';

const COLORS = ['#b5ff2d', '#53a7ff', '#a58bfa', '#ffb347', '#ff667a', '#41d9b0', '#e58bdf'];
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const format = (value: unknown, money = false) => typeof value === 'number' && Number.isFinite(value)
  ? `${number.format(value)}${money ? ' FCFA' : ''}` : 'Indisponible';
const axisTick = { fill: 'var(--fg3)', fontSize: 10 };
const shortName = (value: string) => value.length > 19 ? `${value.slice(0, 18)}…` : value;

function AnalyticsTooltip({ active, payload, label, money = false, payment = false }: Partial<TooltipContentProps> & { money?: boolean; payment?: boolean }) {
  if (!active || !payload?.length) return null;
  const title = payload[0]?.payload?.name || payload[0]?.payload?.label || label;
  return <div className="dashboard-chart-tooltip">
    <div className="dashboard-chart-tooltip-title">{title}</div>
    {payload.map((item, index) => <div className="dashboard-chart-tooltip-row" key={`${String(item.dataKey ?? item.name)}-${index}`}>
      <span style={{ color: item.color }}>{item.name}</span>
      <strong className="num">{format(item.value, money)}</strong>
    </div>)}
    {payment && <div className="dashboard-chart-tooltip-note">{format(payload[0]?.payload?.count)} paiement(s)</div>}
  </div>;
}

function EmptyChart({ unavailable, message }: { unavailable?: boolean; message: string }) {
  return <div className="dashboard-chart-empty" role="status">
    <span className="dashboard-chart-empty-symbol" aria-hidden="true">—</span>
    <strong>{unavailable ? 'Données indisponibles' : message}</strong>
    <span>{unavailable ? 'Actualisez la page pour réessayer.' : 'Les données apparaîtront ici dès qu’une activité sera enregistrée.'}</span>
  </div>;
}

function ChartCard({ title, subtitle, value, action, children, footnote }: {
  title: string; subtitle: string; value?: string; action?: ReactNode; children: ReactNode; footnote?: string;
}) {
  const id = useId();
  return <section className="card dashboard-chart-card" aria-labelledby={id}>
    <div className="dashboard-chart-header">
      <div><h2 id={id} className="section-label">{title}</h2><p>{subtitle}</p></div>
      {action || (value && <span className="dashboard-chart-total num">{value}</span>)}
    </div>
    {children}
    {footnote && <p className="dashboard-chart-footnote">{footnote}</p>}
  </section>;
}

function TimeChart({ data, field, kind, money = false, color, empty }: {
  data: DashboardAnalytics['series']; field: 'revenue' | 'newMembers' | 'entries';
  kind: 'area' | 'line' | 'bar'; money?: boolean; color: string; empty: string;
}) {
  const id = useId().replace(/:/g, '');
  const available = Array.isArray(data) && data.every(point => Number.isFinite(point[field]));
  if (!available || !data.some(point => Number.isFinite(point[field]) && point[field] !== 0)) return <EmptyChart unavailable={!available} message={empty} />;
  const label = field === 'revenue' ? 'Revenus' : field === 'newMembers' ? 'Nouveaux adhérents' : 'Entrées';
  const axes = <>
    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} tickMargin={12} />
    <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={55} tickFormatter={value => compact.format(value)} />
    <Tooltip content={<AnalyticsTooltip money={money} />} cursor={kind === 'bar' ? { fill: 'var(--border)' } : { stroke: 'var(--border2)' }} />
  </>;
  const chartProps = { data, margin: { top: 16, right: 12, left: 0, bottom: 8 }, accessibilityLayer: true };
  return <div className="dashboard-chart-plot" role="group" aria-label={`${label}, sur la période sélectionnée${money ? ', en FCFA' : ''}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      {kind === 'bar' ? <BarChart {...chartProps}>{axes}<Bar dataKey={field} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} /></BarChart>
        : kind === 'line' ? <LineChart {...chartProps}>{axes}<Line dataKey={field} name={label} type="linear" stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} /></LineChart>
        : <AreaChart {...chartProps}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
          {axes}<Area dataKey={field} name={label} type="linear" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} connectNulls={false} isAnimationActive={false} />
        </AreaChart>}
    </ResponsiveContainer>
  </div>;
}

function Distribution({ rows, money = false, empty }: { rows: { key: string; label: string; value: number; count?: number }[] | null; money?: boolean; empty: string }) {
  const available = Array.isArray(rows) && rows.every(row => Number.isFinite(row.value));
  const positive = (rows ?? []).filter(row => Number.isFinite(row.value) && row.value > 0);
  if (!available || !positive.length) return <EmptyChart unavailable={!available} message={empty} />;
  const slices = (rows ?? []).map((row, index) => ({ ...row, name: row.label, fill: COLORS[index % COLORS.length] }));
  return <div className="dashboard-chart-distribution">
    <div className="dashboard-chart-donut">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart accessibilityLayer><Pie data={slices.filter(row => row.value > 0)} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%" paddingAngle={positive.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
          {slices.filter(row => row.value > 0).map(row => <Cell key={row.key} fill={row.fill} />)}
        </Pie><Tooltip content={<AnalyticsTooltip money={money} payment={money} />} /></PieChart>
      </ResponsiveContainer>
    </div>
    <ul className="dashboard-chart-legend" aria-label="Répartition détaillée">
      {slices.map(row => <li key={row.key}>
        <span className="dashboard-chart-swatch" style={{ background: row.fill }} aria-hidden="true" />
        <span className="dashboard-chart-legend-label">{row.label}{money && <small>{format(row.count)} paiement(s)</small>}</span>
        <strong className="num">{format(row.value, money)}</strong>
      </li>)}
    </ul>
  </div>;
}

export function AnalyticsCharts({ data }: { data: DashboardAnalytics }) {
  const [metric, setMetric] = useState<GymMetric>('revenue');
  const ranking = rankGyms(data.gyms ?? [], metric);
  const gymLabel = metric === 'revenue' ? 'Revenus' : metric === 'members' ? 'Adhérents' : 'Entrées';
  const gymAvailable = ranking.gyms.some(gym => Number.isFinite(gym[metric]));
  const gymActivity = ranking.gyms.some(gym => Number.isFinite(gym[metric]) && gym[metric] !== 0);
  const period = data.range.label;
  const subscriptions = data.subscriptions?.map(item => ({ key: item.status, label: item.label, value: item.count })) ?? null;
  const payments = data.paymentModes?.map(item => ({ key: item.mode, label: item.label, value: item.amount, count: item.count })) ?? null;
  return <div className="dashboard-analytics-grid">
    <ChartCard title="Revenus encaissés" subtitle={period} value={format(data.totals.revenue, true)} footnote="Montants encaissés sur la période, en FCFA.">
      <TimeChart data={data.series} field="revenue" kind="area" money color={COLORS[0]} empty="Aucun revenu sur cette période" />
    </ChartCard>
    <ChartCard title="Nouveaux adhérents" subtitle={period} value={format(data.totals.newMembers)} footnote="Inscriptions enregistrées sur la période.">
      <TimeChart data={data.series} field="newMembers" kind="line" color={COLORS[2]} empty="Aucune inscription sur cette période" />
    </ChartCard>
    <ChartCard title="Fréquentation" subtitle={period} value={format(data.totals.entries)} footnote="Nombre d’entrées enregistrées, et non de personnes uniques.">
      <TimeChart data={data.series} field="entries" kind="bar" color={COLORS[1]} empty="Aucune entrée sur cette période" />
    </ChartCard>
    <ChartCard title="État des adhérents" subtitle="Abonnements et cartes · situation actuelle" value={format(data.totals.members)} footnote="État actuel des droits et cartes : chaque adhérent est compté une fois, indépendamment de la période sélectionnée.">
      <Distribution rows={subscriptions} empty="Aucun adhérent enregistré" />
    </ChartCard>
    <ChartCard title="Modes de paiement" subtitle={period} value={format(data.totals.payments) + ' paiements'} footnote="Répartition par montant encaissé. Le détail indique aussi le nombre de paiements.">
      <Distribution rows={payments} money empty="Aucun montant encaissé sur cette période" />
    </ChartCard>
    <ChartCard title="Comparaison des salles" subtitle={metric === 'members' ? 'Adhérents actuels · classement' : `${period} · classement`} action={
      <select className="dashboard-chart-select" aria-label="Comparer les salles par" value={metric} onChange={event => setMetric(event.target.value as GymMetric)}>
        <option value="revenue">Revenus (FCFA)</option><option value="members">Adhérents</option><option value="entries">Entrées</option>
      </select>
    } footnote={`${ranking.omittedCount ? `Top ${ranking.gyms.length} sur ${ranking.count} salles` : `${ranking.count} salle(s)`} · Total toutes salles : ${format(ranking.total, metric === 'revenue')}${metric === 'members' ? ' adhérents actuels' : metric === 'entries' ? ' entrées' : ''}.`}>
      {!gymAvailable || !gymActivity ? <EmptyChart unavailable={!Array.isArray(data.gyms) || (ranking.count > 0 && !gymAvailable)} message="Aucune activité à comparer" /> : <div className="dashboard-chart-plot dashboard-chart-ranking" role="group" aria-label={`Classement des salles par ${gymLabel.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={ranking.gyms} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 6 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={value => compact.format(value)} />
            <YAxis type="category" dataKey="name" width={118} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={shortName} interval={0} />
            <Tooltip content={<AnalyticsTooltip money={metric === 'revenue'} />} cursor={{ fill: 'var(--border)' }} />
            <Bar dataKey={metric} name={gymLabel} fill={COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
    </ChartCard>
  </div>;
}
