'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Shell from '@/components/shell';
import { adminApi, fmtFcfa, GlobalStats } from '@/lib/api';
import {
  Building2, Users, TrendingUp, Footprints,
  AlertCircle, RefreshCw,
} from 'lucide-react';

/* ── Chart tooltip ───────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card2)',
      border: '1px solid var(--border2)',
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--fg3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
        {fmtFcfa(Number(payload[0]?.value ?? 0))}
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */
interface KpiCardProps {
  label: string;
  value: string | number | null;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  accent?: boolean;
}
function KpiCard({ label, value, icon, iconColor, iconBg, accent }: KpiCardProps) {
  if (value === null) {
    return (
      <div className={accent ? 'card-accent' : 'card'} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 9, width: '55%' }} />
        <div className="skeleton" style={{ height: 30, width: '75%' }} />
      </div>
    );
  }
  return (
    <div className={accent ? 'card-accent' : 'card'} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-label">{label}</span>
        <span style={{
          width: 34, height: 34, borderRadius: 9,
          background: iconBg,
          border: `1px solid ${iconColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor, flexShrink: 0,
        }}>
          {icon}
        </span>
      </div>
      <div className={accent ? 'stat-value stat-value-accent' : 'stat-value'} style={{ fontSize: 26 }}>
        {value}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    adminApi.get('/api/v1/dashboard/global')
      .then((r) => {
        setStats(r.data);
        setLastUpdated(
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        );
      })
      .catch(() => setError('Impossible de charger les statistiques'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = stats?.top5Gyms?.length
    ? Math.max(...stats.top5Gyms.map((g) => g.revenuMois), 1)
    : 1;

  const totalPerGym = stats?.revenuePerGym?.reduce((s, g) => s + g.revenuMois, 0) ?? 1;

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ══ HEADER ══════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span className="status-dot status-dot-accent" />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                LIVE
              </span>
            </div>
            <h1 className="page-title">Vue d&apos;ensemble</h1>
            <p className="page-sub">Toutes les salles · Données en temps réel</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}>
                Actualisé à {lastUpdated}
              </span>
            )}
            <button
              className="btn-ghost"
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ padding: '6px 12px', gap: 6, fontSize: 12 }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.65s linear infinite' : 'none' }} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ══ ERROR ════════════════════════════════════════ */}
        {error && (
          <div className="banner-error">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* ══ KPI CARDS ════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <KpiCard
            label="Salles actives"
            value={loading ? null : stats?.nbGyms ?? 0}
            icon={<Building2 size={14} />}
            iconColor="var(--blue)"
            iconBg="var(--blue-dim)"
          />
          <KpiCard
            label="Adhérents total"
            value={loading ? null : (stats?.nbAdherents ?? 0).toLocaleString('fr-FR')}
            icon={<Users size={14} />}
            iconColor="var(--purple)"
            iconBg="var(--purple-dim)"
          />
          <KpiCard
            label="Revenu ce mois"
            value={loading ? null : fmtFcfa(stats?.revenuMois ?? 0)}
            icon={<TrendingUp size={14} />}
            iconColor="var(--accent)"
            iconBg="var(--accent-dim)"
            accent
          />
          <KpiCard
            label="Entrées aujourd'hui"
            value={loading ? null : stats?.nbEntreesAujourdhui ?? 0}
            icon={<Footprints size={14} />}
            iconColor="var(--success)"
            iconBg="var(--success-dim)"
          />
        </div>

        {/* ══ MAIN ROW ════════════════════════════════════ */}
        {!loading && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>

              {/* Area chart */}
              <div className="card" style={{ padding: '20px 20px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div className="section-label">Revenus globaux</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginTop: 3 }}>
                      6 derniers mois
                    </div>
                  </div>
                  {stats.revenueChart?.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)',
                      borderRadius: 6, padding: '4px 10px',
                    }}>
                      <TrendingUp size={11} style={{ color: 'var(--accent)' }} />
                      <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                        {fmtFcfa(stats.revenueChart[stats.revenueChart.length - 1]?.revenu ?? 0)}
                      </span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={stats.revenueChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b5ff2d" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#b5ff2d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--fg3)', fontSize: 11 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--fg3)', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                      width={38}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ stroke: 'var(--border2)', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenu"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={{ fill: 'var(--accent)', strokeWidth: 0, r: 3 }}
                      activeDot={{ fill: 'var(--accent)', r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top 5 gyms */}
              <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '16px 18px 12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div className="section-label">Top salles</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginTop: 3 }}>
                      Ce mois
                    </div>
                  </div>
                  <span className="badge badge-accent">TOP 5</span>
                </div>
                <div style={{ flex: 1, padding: '4px 0' }}>
                  {stats.top5Gyms.map((g, i) => (
                    <div
                      key={g.gymId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11,
                        padding: '11px 18px', transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="num" style={{
                        fontSize: 10, fontWeight: 800, width: 18, textAlign: 'center',
                        color: i === 0 ? 'var(--accent)' : 'var(--fg3)',
                        letterSpacing: '0.05em',
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 600, color: 'var(--fg)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          marginBottom: 5,
                        }}>
                          {g.gymNom}
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(g.revenuMois / maxRevenue) * 100}%`,
                            background: i === 0
                              ? 'linear-gradient(90deg, var(--accent), #d4ff6e)'
                              : 'var(--border3)',
                            borderRadius: 2,
                          }} />
                        </div>
                      </div>
                      <span className="num" style={{
                        fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                        color: i === 0 ? 'var(--accent)' : 'var(--fg2)',
                      }}>
                        {fmtFcfa(g.revenuMois)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══ REVENUE PER GYM ══════════════════════════ */}
            {stats.revenuePerGym?.length > 0 && (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div className="section-label">Répartition du revenu par salle</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginTop: 3 }}>
                    Mois en cours
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {[...stats.revenuePerGym]
                    .sort((a, b) => b.revenuMois - a.revenuMois)
                    .map((g) => {
                      const pct = totalPerGym > 0 ? (g.revenuMois / totalPerGym) * 100 : 0;
                      return (
                        <div key={g.gymId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 130, fontSize: 12, color: 'var(--fg2)', fontWeight: 500,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0,
                          }}>
                            {g.gymNom}
                          </div>
                          <div style={{
                            flex: 1, height: 6, background: 'var(--border)',
                            borderRadius: 3, overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: 'linear-gradient(90deg, var(--blue), var(--accent))',
                              borderRadius: 3,
                            }} />
                          </div>
                          <span className="num" style={{ fontSize: 11, color: 'var(--fg3)', width: 32, textAlign: 'right', flexShrink: 0 }}>
                            {pct.toFixed(0)}%
                          </span>
                          <span className="num" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg2)', width: 90, textAlign: 'right', flexShrink: 0 }}>
                            {fmtFcfa(g.revenuMois)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ LOADING SKELETON ═════════════════════════════ */}
        {loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
              <div className="card" style={{ padding: 20, height: 280 }}>
                <div className="skeleton" style={{ height: 10, width: 120, marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
              </div>
              <div className="card" style={{ height: 280 }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 10, width: 80 }} />
                </div>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: 8, width: 16, flexShrink: 0 }} />
                    <div className="skeleton" style={{ height: 8, flex: 1 }} />
                    <div className="skeleton" style={{ height: 8, width: 80, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ height: 200 }} />
          </>
        )}
      </div>
    </Shell>
  );
}
