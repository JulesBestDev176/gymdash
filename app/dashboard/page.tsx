'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '@/components/shell';
import StatCard from '@/components/stat-card';
import { adminApi, fmtFcfa, GlobalStats } from '@/lib/api';
import { Building2, Users, TrendingUp, Footprints } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get('/dashboard/global')
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard global</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Vue d&apos;ensemble de toutes les salles</p>
        </div>

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Chargement...</div>
        ) : stats ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Salles actives"
                value={stats.nbGyms}
                icon={<Building2 size={18} />}
              />
              <StatCard
                label="Adhérents total"
                value={stats.nbAdherents.toLocaleString('fr-FR')}
                icon={<Users size={18} />}
              />
              <StatCard
                label="Revenu ce mois"
                value={fmtFcfa(stats.revenuMois)}
                accent
                icon={<TrendingUp size={18} />}
              />
              <StatCard
                label="Entrées aujourd'hui"
                value={stats.nbEntreesAujourdhui}
                icon={<Footprints size={18} />}
              />
            </div>

            {/* Graphe revenus globaux */}
            <div className="rounded-xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
              <h2 className="text-base font-semibold mb-4">Revenus globaux — 6 derniers mois</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.revenueChart} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3347" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip
                    contentStyle={{ background: '#1a1f2e', border: '1px solid #2d3347', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9', fontSize: 12 }}
                    formatter={(v: number) => [fmtFcfa(v), 'Revenu']}
                  />
                  <Bar dataKey="revenu" fill="#b5ff2d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 5 salles */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
              <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
                Top 5 salles ce mois
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                    <th className="text-left px-5 py-3 font-medium">#</th>
                    <th className="text-left px-5 py-3 font-medium">Salle</th>
                    <th className="text-right px-5 py-3 font-medium">Revenu</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top5Gyms.map((g, i) => (
                    <tr key={g.gymId} style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card)' }}
                      className="hover:brightness-110 transition-all">
                      <td className="px-5 py-3 font-bold" style={{ color: i === 0 ? 'var(--accent)' : 'var(--muted)' }}>
                        {i + 1}
                      </td>
                      <td className="px-5 py-3 font-medium">{g.gymNom}</td>
                      <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--accent)' }}>
                        {fmtFcfa(g.revenuMois)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-sm" style={{ color: 'var(--danger)' }}>Erreur de chargement</div>
        )}
      </div>
    </Shell>
  );
}
