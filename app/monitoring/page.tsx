'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { RefreshCw, RotateCcw, ExternalLink, AlertTriangle, Server, Database, Globe, Cpu } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
interface ServiceInfo {
  uuid: string; name: string; fqdn: string | null;
  status: string; image: string | null; latencyMs: number | null; group: string;
}
interface MonitoringData {
  services: ServiceInfo[];
  serverStatus: { reachable: boolean; ip: string };
  timestamp: string;
}

/* ── Constants ──────────────────────────────────────────────── */
const REFRESH_INTERVAL = 30;

const SERVICE_LABELS: Record<string, string> = {
  'gympass-backend':  'API Backend',
  'gymdash':          'Dashboard Admin',
  'gympass-postgres': 'Base de données',
};

const SERVICE_ICONS: Record<string, React.ElementType> = {
  'gympass-backend':  Server,
  'gymdash':          Globe,
  'gympass-postgres': Database,
};

/* ── Status resolution ──────────────────────────────────────── */
function resolveStatus(raw: string): 'up' | 'down' | 'degraded' {
  const s = (raw ?? '').toLowerCase();
  if (s === 'running:healthy' || s === 'running' || s === 'up') return 'up';
  if (s.includes('running') || s.includes('restart') || s.includes('start') || s === 'degraded') return 'degraded';
  return 'down';
}

const STATUS_META: Record<'up' | 'down' | 'degraded', { label: string; color: string; bg: string; dotCls: string }> = {
  up:       { label: 'En ligne',  color: 'var(--success)', bg: 'var(--success-dim)', dotCls: 'status-dot status-dot-success' },
  degraded: { label: 'Instable',  color: 'var(--warning)', bg: 'var(--warning-dim)', dotCls: 'status-dot status-dot-warning' },
  down:     { label: 'Hors ligne',color: 'var(--danger)',  bg: 'var(--danger-dim)',  dotCls: 'status-dot status-dot-danger'  },
};

function latencyColor(ms: number | null): string {
  if (ms == null) return 'var(--fg3)';
  if (ms < 300)   return 'var(--success)';
  if (ms < 1000)  return 'var(--warning)';
  return 'var(--danger)';
}

/* ── Page ───────────────────────────────────────────────────── */
export default function MonitoringPage() {
  const [data, setData]               = useState<MonitoringData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL);
  const [redeploying, setRedeploying] = useState<string | null>(null);
  const [confirm, setConfirm]         = useState<{ uuid: string; name: string } | null>(null);
  const [confirmTick, setConfirmTick] = useState(5);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring');
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); setCountdown(REFRESH_INTERVAL); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Auto-refresh countdown */
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { fetchData(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  /* Confirm modal countdown */
  useEffect(() => {
    if (!confirm) return;
    setConfirmTick(5);
    const t = setInterval(() => {
      setConfirmTick((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [confirm]);

  async function handleRedeploy(uuid: string) {
    setRedeploying(uuid);
    try {
      await fetch('/api/coolify/redeploy', {
        method: 'POST',
        body: JSON.stringify({ uuid }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch { /* ignore */ }
    finally { setRedeploying(null); setTimeout(fetchData, 3000); }
  }

  /* Computed stats */
  const services  = data?.services ?? [];
  const statuses  = services.map((s) => resolveStatus(s.status));
  const upCount   = statuses.filter((s) => s === 'up').length;
  const downCount = statuses.filter((s) => s === 'down').length;
  const degraded  = statuses.filter((s) => s === 'degraded').length;
  const allUp     = downCount === 0 && degraded === 0 && services.length > 0;
  const avgLatency = (() => {
    const valid = services.filter((s) => s.latencyMs != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, s) => a + (s.latencyMs ?? 0), 0) / valid.length);
  })();

  /* Progress bar pct for countdown ring */
  const pct = ((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100;

  return (
    <Shell>
      {/* ── Confirmation modal ─────────────────────── */}
      {confirm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setConfirm(null); } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border2)',
            borderRadius: 16, width: '100%', maxWidth: 420,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            animation: 'fadeUp 0.18s ease both', overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--warning-dim)', border: '1px solid rgba(255,170,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', flexShrink: 0 }}>
                <AlertTriangle size={17} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>Confirmer le redéploiement</div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>{confirm.name}</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.6 }}>
              Cette action redémarre le service en production et peut provoquer une interruption temporaire.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setConfirm(null)}>Annuler</button>
              <button
                className="btn-danger"
                style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 7 }}
                disabled={confirmTick > 0}
                onClick={() => { handleRedeploy(confirm.uuid); setConfirm(null); }}
              >
                <RotateCcw size={13} />
                {confirmTick > 0 ? `Confirmer (${confirmTick}s)` : 'Confirmer le redéploiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Monitoring</h1>
            <p className="page-sub">
              {data
                ? <>Dernière vérification à <span className="num">{new Date(data.timestamp).toLocaleTimeString('fr-FR')}</span></>
                : 'État des services en temps réel'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Countdown ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 32, height: 32 }}>
                <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border2)" strokeWidth="2.5" />
                  <circle cx="16" cy="16" r="12" fill="none"
                    stroke="var(--accent)" strokeWidth="2.5"
                    strokeDasharray={`${2 * Math.PI * 12}`}
                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--fg3)' }}>
                  {countdown}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--fg3)' }}>auto-refresh</span>
            </div>
            <button className="btn-ghost" style={{ fontSize: 12.5, padding: '7px 13px' }} onClick={() => { setLoading(true); fetchData(); }}>
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>
        </div>

        {/* ── Global status banner ────────────────────── */}
        {data && (
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: allUp ? 'var(--success-dim)' : 'var(--danger-dim)',
              border: `1px solid ${allUp ? 'rgba(34,217,110,0.2)' : 'rgba(255,68,85,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className={allUp ? 'status-dot status-dot-success' : 'status-dot status-dot-danger'}
                style={{ width: 10, height: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--fg)', marginBottom: 3 }}>
                {allUp ? 'Tous les services opérationnels' : `${downCount} service${downCount > 1 ? 's' : ''} hors ligne`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
                Serveur Coolify{' '}
                <span style={{ color: data.serverStatus.reachable ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                  {data.serverStatus.reachable ? 'accessible' : 'inaccessible'}
                </span>
                {' — '}
                <span className="num" style={{ color: 'var(--fg2)' }}>{data.serverStatus.ip}</span>
              </div>
            </div>
            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: allUp ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
              {upCount}<span style={{ fontSize: 13, color: 'var(--fg3)', fontWeight: 400 }}>/{services.length}</span>
            </span>
          </div>
        )}

        {/* ── KPI chips ──────────────────────────────── */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'En ligne',   value: upCount,    color: upCount === services.length ? 'var(--success)' : 'var(--fg)', accent: upCount === services.length },
              { label: 'Hors ligne', value: downCount,  color: downCount > 0 ? 'var(--danger)' : 'var(--fg3)' },
              { label: 'Instables',  value: degraded,   color: degraded > 0 ? 'var(--warning)' : 'var(--fg3)' },
              { label: 'Latence moy', value: avgLatency != null ? `${avgLatency}ms` : '—', color: latencyColor(avgLatency), isText: true },
            ].map(({ label, value, color, accent, isText }) => (
              <div key={label} className={accent ? 'card-accent' : 'card'} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="section-label">{label}</span>
                <span className={`stat-value num ${accent ? 'stat-value-accent' : ''}`} style={{ fontSize: 26, color: accent ? undefined : color }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Service list ──────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 14, width: 140 }} />
                  <div className="skeleton" style={{ height: 11, width: 200 }} />
                </div>
                <div style={{ minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 11, width: 80 }} />
                  <div className="skeleton" style={{ height: 6, borderRadius: 4 }} />
                </div>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="banner-error" role="alert">
            <AlertTriangle size={14} />
            Aucun service GymPass détecté — vérifiez la connectivité Coolify
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.map((svc) => {
              const status   = resolveStatus(svc.status);
              const meta     = STATUS_META[status];
              const label    = SERVICE_LABELS[svc.name] ?? svc.name;
              const Icon     = SERVICE_ICONS[svc.name] ?? Cpu;
              const latency  = svc.latencyMs;
              const lColor   = latencyColor(latency);
              const barPct   = latency != null ? Math.min(100, (latency / 2000) * 100) : 0;
              const isRedeploying = redeploying === svc.uuid;
              const fqdnClean = svc.fqdn?.replace(/^https?:\/\//, '') ?? null;

              return (
                <div key={svc.uuid} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>

                  {/* Icon + status */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                    background: meta.bg,
                    border: `1px solid ${meta.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: meta.color, position: 'relative',
                  }}>
                    <Icon size={20} />
                    <span
                      className={meta.dotCls}
                      style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10 }}
                    />
                  </div>

                  {/* Service info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>{label}</span>
                      <span className={`badge badge-${status === 'up' ? 'success' : status === 'degraded' ? 'warning' : 'danger'}`} style={{ fontSize: 9.5 }}>
                        {meta.label}
                      </span>
                      {svc.group && (
                        <span className="badge badge-neutral" style={{ fontSize: 9.5 }}>{svc.group}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {fqdnClean && (
                        <a
                          href={svc.fqdn!.startsWith('http') ? svc.fqdn! : `https://${svc.fqdn}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg3)', textDecoration: 'none', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
                        >
                          {fqdnClean} <ExternalLink size={10} style={{ flexShrink: 0 }} />
                        </a>
                      )}
                      {svc.image && (
                        <span style={{ fontSize: 11, color: 'var(--fg3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px', fontFamily: 'monospace' }}>
                          {svc.image}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Latency bar */}
                  <div style={{ minWidth: 180, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="section-label">Latence</span>
                      <span className="num" style={{ fontSize: 12, fontWeight: 700, color: lColor }}>
                        {latency != null ? `${latency} ms` : '—'}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 5, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${barPct}%`,
                        background: lColor, borderRadius: 5,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--fg3)' }}>
                      <span>0</span>
                      <span>300ms</span>
                      <span>2s</span>
                    </div>
                  </div>

                  {/* Redeploy button */}
                  <button
                    onClick={() => setConfirm({ uuid: svc.uuid, name: label })}
                    disabled={isRedeploying}
                    title={`Redéployer ${label}`}
                    style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      border: '1px solid var(--border2)', background: 'var(--card2)',
                      cursor: 'pointer', color: 'var(--fg3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                      opacity: isRedeploying ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--warning)'; e.currentTarget.style.borderColor = 'rgba(255,170,0,0.3)'; e.currentTarget.style.background = 'var(--warning-dim)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg3)'; e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--card2)'; }}
                  >
                    {isRedeploying ? <Spinner size="sm" /> : <RotateCcw size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
