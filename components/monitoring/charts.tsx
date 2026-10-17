'use client';

import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CollectorSnapshot } from '@/lib/monitoring-model';

const tick = { fill: 'var(--fg3)', fontSize: 10 };
const tooltip = { background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--fg)', fontSize: 12 };
const time = (value: string) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const label = (value: unknown) => new Date(String(value)).toLocaleString('fr-FR');

export function SystemChart({ history }: { history: CollectorSnapshot['history'] }) {
  if (!history.length) return <div className="monitor-empty">La collecte vient de démarrer. Le premier point apparaîtra dans quelques instants.</div>;
  return <div style={{ width: '100%', height: 280, minWidth: 0 }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={history} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={time} tick={tick} minTickGap={35} />
        <YAxis domain={[0, 100]} tick={tick} unit="%" />
        <Tooltip contentStyle={tooltip} labelFormatter={label} formatter={(v) => [`${Number(v).toFixed(1)} %`]} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Area type="monotone" dataKey="cpuPercent" name="CPU" stroke="#b5ff2d" fill="#b5ff2d" fillOpacity={0.06} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        <Area type="monotone" dataKey="memoryPercent" name="Mémoire" stroke="#5b9cf6" fill="#5b9cf6" fillOpacity={0.04} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        <Area type="monotone" dataKey="diskPercent" name="Disque" stroke="#a78bfa" fill="transparent" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function RequestCharts({ history }: { history: CollectorSnapshot['api']['history'] }) {
  if (!history.length) return <div className="monitor-empty">Aucune requête mesurée sur cette période. Les mesures sont envoyées par le backend toutes les 30 secondes.</div>;
  return <div className="monitor-grid-2">
    <div style={{ minWidth: 0 }}><p className="section-label" style={{ marginBottom: 16 }}>Requêtes par intervalle</p>
      <div style={{ width: '100%', height: 210 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ left: -20, right: 10 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={time} tick={tick} minTickGap={35} /><YAxis tick={tick} allowDecimals={false} />
        <Tooltip contentStyle={tooltip} labelFormatter={label} />
        <Area dataKey="count" name="Requêtes" stroke="#5b9cf6" fill="#5b9cf6" fillOpacity={0.12} isAnimationActive={false} />
        <Area dataKey="errors5xx" name="Erreurs 5xx" stroke="#ff4455" fill="#ff4455" fillOpacity={0.15} isAnimationActive={false} />
      </AreaChart></ResponsiveContainer></div>
    </div>
    <div style={{ minWidth: 0 }}><p className="section-label" style={{ marginBottom: 16 }}>Durée moyenne des requêtes</p>
      <div style={{ width: '100%', height: 210 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ left: -12, right: 10 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={time} tick={tick} minTickGap={35} /><YAxis tick={tick} unit="ms" width={58} />
        <Tooltip contentStyle={tooltip} labelFormatter={label} formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'Durée moyenne']} />
        <Line dataKey="avgMs" stroke="#b5ff2d" dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div>
    </div>
  </div>;
}
