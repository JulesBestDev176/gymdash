'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { getAuditEntries, AuditEntry } from '@/lib/audit';
import { ClipboardList, Trash2, Activity, LogIn, PlusCircle, RefreshCw, Trash, ToggleLeft } from 'lucide-react';

/* ── types ─────────────────────────────────────────────────── */
type ActionKey = 'LOGIN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE';

interface ServiceSummary { total: number; up: number; down: number; degraded: number; }

/* ── constants ──────────────────────────────────────────────── */
const ACTION_META: Record<ActionKey, { label: string; bg: string; color: string }> = {
  LOGIN:  { label: 'LOGIN',  bg: 'rgba(34,217,110,0.12)',  color: 'var(--success)' },
  CREATE: { label: 'CREATE', bg: 'rgba(181,255,45,0.12)',  color: 'var(--accent)'  },
  UPDATE: { label: 'UPDATE', bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa'         },
  DELETE: { label: 'DELETE', bg: 'rgba(255,68,85,0.12)',   color: 'var(--danger)'  },
  TOGGLE: { label: 'TOGGLE', bg: 'rgba(255,170,0,0.12)',   color: 'var(--warning)' },
};

const ACTION_ICONS: Record<ActionKey, React.ReactNode> = {
  LOGIN:  <LogIn size={11} />,
  CREATE: <PlusCircle size={11} />,
  UPDATE: <RefreshCw size={11} />,
  DELETE: <Trash size={11} />,
  TOGGLE: <ToggleLeft size={11} />,
};

function getActionKey(action: string): ActionKey {
  for (const k of Object.keys(ACTION_META) as ActionKey[]) {
    if (action.startsWith(k)) return k;
  }
  return 'UPDATE';
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── page ───────────────────────────────────────────────────── */
export default function AuditPage() {
  const [entries, setEntries]             = useState<AuditEntry[]>([]);
  const [serviceSummary, setServiceSummary] = useState<ServiceSummary | null>(null);
  const [loadingSvc, setLoadingSvc]       = useState(true);

  useEffect(() => {
    setEntries(getAuditEntries());
    fetch('/api/monitoring')
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) {
          const total = data.services.length;
          const up = data.services.filter((s: { status: string }) => {
            const st = s.status.toLowerCase();
            return st === 'running:healthy' || st === 'running' || st === 'up';
          }).length;
          const degraded = data.services.filter((s: { status: string }) => {
            const st = s.status.toLowerCase();
            return st.includes('running') && st !== 'running:healthy' && st !== 'running';
          }).length;
          setServiceSummary({ total, up, down: total - up - degraded });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSvc(false));
  }, []);

  function clearAudit() {
    localStorage.removeItem('gymdash_audit');
    setEntries([]);
  }

  /* counts */
  const counts = (Object.keys(ACTION_META) as ActionKey[]).reduce<Record<ActionKey, number>>(
    (acc, k) => { acc[k] = entries.filter((e) => e.action.startsWith(k)).length; return acc; },
    { LOGIN: 0, CREATE: 0, UPDATE: 0, DELETE: 0, TOGGLE: 0 },
  );

  const upPct = serviceSummary && serviceSummary.total > 0
    ? Math.round((serviceSummary.up / serviceSummary.total) * 100)
    : 0;

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Journal d&apos;audit</h1>
            <p className="page-sub">
              <span className="num">{entries.length}</span> entrée{entries.length !== 1 ? 's' : ''} — stockées localement
            </p>
          </div>
          {entries.length > 0 && (
            <button onClick={clearAudit} className="btn-danger"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', fontSize: 13, borderRadius: 10 }}>
              <Trash2 size={13} /> Effacer
            </button>
          )}
        </div>

        {/* KPI chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {(Object.keys(ACTION_META) as ActionKey[]).map((k) => {
            const m = ACTION_META[k];
            return (
              <div key={k} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="section-label">{m.label}</span>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                    {ACTION_ICONS[k]}
                  </span>
                </div>
                <div className="stat-value num" style={{ fontSize: 26, color: m.color }}>{counts[k]}</div>
              </div>
            );
          })}
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>

          {/* Audit table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {entries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg3)' }}>
                  <ClipboardList size={20} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg2)' }}>Aucune entrée d&apos;audit</div>
                <div style={{ fontSize: 12, color: 'var(--fg3)', textAlign: 'center' }}>
                  Les actions (connexion, création, etc.) apparaîtront ici
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Action</th>
                    <th>Détail</th>
                    <th style={{ width: 130 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const k = getActionKey(e.action);
                    const m = ACTION_META[k];
                    return (
                      <tr key={e.id}>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                            background: m.bg, color: m.color,
                          }}>
                            {ACTION_ICONS[k]}
                            {e.action}
                          </span>
                        </td>
                        <td style={{ color: 'var(--fg2)', fontSize: 13 }}>{e.detail}</td>
                        <td>
                          <span className="num" style={{ fontSize: 11.5, color: 'var(--fg3)' }}>
                            {fmtDate(e.ts)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Service status */}
            <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(181,255,45,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Activity size={13} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>État des services</span>
              </div>

              {loadingSvc ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[80, 60, 70].map((w, i) => <div key={i} className="skeleton" style={{ height: 10, width: `${w}%` }} />)}
                </div>
              ) : serviceSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Total</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{serviceSummary.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg3)' }}>En ligne</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{serviceSummary.up}</span>
                  </div>
                  {serviceSummary.degraded > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Instables</span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>{serviceSummary.degraded}</span>
                    </div>
                  )}
                  {serviceSummary.down > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Hors ligne</span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{serviceSummary.down}</span>
                    </div>
                  )}
                  {/* Progress bar */}
                  <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginTop: 2 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${upPct}%`,
                      background: serviceSummary.down > 0 ? 'var(--danger)' : serviceSummary.degraded > 0 ? 'var(--warning)' : 'var(--success)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span className="num" style={{ fontSize: 11, color: 'var(--fg3)' }}>{upPct}% opérationnels</span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--fg3)' }}>Données non disponibles</p>
              )}
            </div>

            {/* Audit stats */}
            <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Répartition</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.keys(ACTION_META) as ActionKey[]).map((k) => {
                  const m = ACTION_META[k];
                  const count = counts[k];
                  const pct = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0;
                  return (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                          background: m.bg, color: m.color,
                        }}>
                          {ACTION_ICONS[k]} {m.label}
                        </span>
                        <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)' }}>{count}</span>
                      </div>
                      {entries.length > 0 && (
                        <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: m.color, transition: 'width 0.4s ease' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Shell>
  );
}
