'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/shell';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import { RefreshCw, RotateCcw, ExternalLink } from 'lucide-react';

interface ServiceInfo {
  uuid: string;
  name: string;
  fqdn: string | null;
  status: string;        // raw Coolify status: "running", "stopped", "restarting", etc.
  image: string | null;
  latencyMs: number | null;
  group: string;
}

interface MonitoringData {
  services: ServiceInfo[];
  serverStatus: { reachable: boolean; ip: string };
  timestamp: string;
}

const LABELS: Record<string, string> = {
  'gympass-backend': 'API Backend',
  'gymdash':         'Dashboard Admin',
  'gympass-postgres':'Base de données',
};

const REFRESH_INTERVAL = 30;

function resolveStatus(raw: string): 'up' | 'down' | 'degraded' {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('running') || s === 'up') return 'up';
  if (s.includes('restart') || s.includes('start')) return 'degraded';
  return 'down';
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning'> = {
  up: 'success', down: 'danger', degraded: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  up: 'En ligne', down: 'Hors ligne', degraded: 'Instable',
};
const STATUS_DOT_CLASS: Record<string, string> = {
  up: 'status-dot status-dot-success',
  down: 'status-dot status-dot-danger',
  degraded: 'status-dot status-dot-warning',
};

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);
  const [redeploying, setRedeploying] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmData, setConfirmData] = useState<{ uuid: string; name: string } | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(5);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring');
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((c) => {
        if (c <= 1) { fetchData(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Countdown for confirmation modal
  useEffect(() => {
    if (!confirmData) return;
    setConfirmCountdown(5);
    const id = setInterval(() => {
      setConfirmCountdown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [confirmData]);

  async function handleRedeploy(uuid: string, name: string) {
    setRedeploying(uuid);
    try {
      await fetch('/api/coolify/redeploy', {
        method: 'POST',
        body: JSON.stringify({ uuid }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setRedeploying(null);
      setTimeout(fetchData, 3000);
    }
  }

  const services = data?.services ?? [];
  const statuses = services.map((s) => resolveStatus(s.status));
  const upCount = statuses.filter((s) => s === 'up').length;
  const downCount = statuses.filter((s) => s === 'down').length;
  const allUp = downCount === 0 && services.length > 0;

  return (
    <Shell>
      {/* Confirmation modal */}
      {confirmData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="card" style={{ padding: '24px', maxWidth: '420px', width: '90%' }}>
            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 6 }}>Confirmer le redéploiement</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{confirmData.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6, lineHeight: 1.5 }}>
                Cette action redémarre le service en production et peut provoquer une interruption de service.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setConfirmData(null); setConfirmCountdown(5); }}>
                Annuler
              </button>
              <button
                className="btn-danger"
                disabled={confirmCountdown > 0}
                onClick={() => {
                  handleRedeploy(confirmData.uuid, confirmData.name);
                  setConfirmData(null);
                  setConfirmCountdown(5);
                }}
              >
                {confirmCountdown > 0 ? `Confirmer (${confirmCountdown}s)` : 'Confirmer le redéploiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 fade-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Monitoring GymPass</h1>
            <p className="page-sub">
              {data ? (
                <>Dernière vérif. {new Date(data.timestamp).toLocaleTimeString('fr-FR')}</>
              ) : 'État des services en temps réel'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="num text-xs" style={{ color: 'var(--fg3)' }}>
              Refresh dans {refreshCountdown}s
            </span>
            <button className="btn-ghost" onClick={() => { setLoading(true); fetchData(); }}>
              <RefreshCw size={13} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Summary banner */}
        {data && (
          <div
            className="card p-4 flex items-center gap-4"
            style={{ borderLeft: `3px solid var(--${allUp ? 'success' : 'danger'})` }}
          >
            <span className={allUp ? 'status-dot status-dot-success' : 'status-dot status-dot-danger'} />
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                {allUp ? 'Tous les services opérationnels' : `${downCount} service(s) hors ligne`}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>
                Serveur Coolify {data.serverStatus.reachable ? 'accessible' : 'inaccessible'} — {data.serverStatus.ip}
              </div>
            </div>
            <div className="ml-auto num text-xs" style={{ color: 'var(--fg3)' }}>
              {upCount}/{services.length} en ligne
            </div>
          </div>
        )}

        {/* Service cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" style={{ color: 'var(--accent)' } as React.CSSProperties} />
          </div>
        ) : services.length === 0 ? (
          <div className="banner-error">
            Aucun service GymPass détecté — vérifiez la connectivité Coolify
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {services.map((svc) => {
              const status = resolveStatus(svc.status);
              const label = LABELS[svc.name] ?? svc.name;
              const latency = svc.latencyMs;
              const maxLatency = 2000;
              const barW = latency != null ? Math.min(100, (latency / maxLatency) * 100) : 0;
              const barColor = latency == null ? 'var(--fg3)'
                : latency < 300 ? 'var(--success)'
                : latency < 1000 ? 'var(--warning)'
                : 'var(--danger)';

              return (
                <div key={svc.uuid} className="card p-5 flex items-center gap-5">
                  {/* Status dot */}
                  <span className={STATUS_DOT_CLASS[status] ?? 'status-dot'} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                        {label}
                      </span>
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {svc.fqdn && (
                        <a
                          href={svc.fqdn.startsWith('http') ? svc.fqdn : `https://${svc.fqdn}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs truncate flex items-center gap-1"
                          style={{ color: 'var(--fg3)' }}
                        >
                          {svc.fqdn.replace(/^https?:\/\//, '')}
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {svc.image && (
                        <span className="text-xs" style={{ color: 'var(--fg3)' }}>
                          · {svc.image}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Latency */}
                  <div style={{ minWidth: '130px' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="section-label">Latence</span>
                      <span className="num text-xs font-semibold" style={{ color: barColor }}>
                        {latency != null ? `${latency}ms` : '—'}
                      </span>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: '4px', background: 'var(--border)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barW}%`, background: barColor, transition: 'width 0.4s ease' }}
                      />
                    </div>
                  </div>

                  {/* Redeploy */}
                  <button
                    className="btn-ghost"
                    style={{ padding: '6px 10px', flexShrink: 0 }}
                    disabled={redeploying === svc.uuid}
                    onClick={() => setConfirmData({ uuid: svc.uuid, name: label })}
                    title="Redéployer"
                  >
                    {redeploying === svc.uuid
                      ? <Spinner size="sm" />
                      : <RotateCcw size={13} />
                    }
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
