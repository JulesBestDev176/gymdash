'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { getAuditEntries, AuditEntry } from '@/lib/audit';
import { ClipboardList, Trash2, Activity } from 'lucide-react';

const ACTION_VARIANT: Record<string, 'accent' | 'success' | 'danger' | 'warning' | 'blue' | 'neutral'> = {
  LOGIN:   'success',
  LOGOUT:  'neutral',
  CREATE:  'accent',
  UPDATE:  'blue',
  DELETE:  'danger',
  TOGGLE:  'warning',
};

interface ServiceSummary {
  total: number;
  up: number;
  down: number;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [serviceSummary, setServiceSummary] = useState<ServiceSummary | null>(null);

  useEffect(() => {
    setEntries(getAuditEntries());

    // Fetch monitoring summary
    fetch('/api/monitoring')
      .then((r) => r.json())
      .then((data) => {
        if (data?.services) {
          const total = data.services.length;
          const up = data.services.filter((s: { status: string }) => s.status === 'up').length;
          setServiceSummary({ total, up, down: total - up });
        }
      })
      .catch(() => {});
  }, []);

  function clearAudit() {
    localStorage.removeItem('gymdash_audit');
    setEntries([]);
  }

  function getActionVariant(action: string) {
    // Match prefix
    for (const [key, variant] of Object.entries(ACTION_VARIANT)) {
      if (action.startsWith(key)) return variant;
    }
    return 'neutral' as const;
  }

  return (
    <Shell>
      <div className="space-y-6 fade-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Journal d&apos;audit</h1>
            <p className="page-sub">
              <span className="num">{entries.length}</span> entrée(s) — stockées localement
            </p>
          </div>
          {entries.length > 0 && (
            <button className="btn-danger" onClick={clearAudit}>
              <Trash2 size={13} />
              Effacer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audit list */}
          <div className="lg:col-span-2">
            {entries.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Aucune entrée d'audit"
                subtitle="Les actions (connexion, création, etc.) apparaîtront ici"
              />
            ) : (
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Détail</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Badge variant={getActionVariant(e.action)}>{e.action}</Badge>
                        </td>
                        <td style={{ color: 'var(--fg2)' }}>{e.detail}</td>
                        <td style={{ color: 'var(--fg3)' }}>
                          <span className="num text-xs">
                            {new Date(e.ts).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick actions panel */}
          <div className="flex flex-col gap-4">
            {/* Service status summary */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} style={{ color: 'var(--accent)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                  État des services
                </span>
              </div>
              {serviceSummary ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--fg2)' }}>Total</span>
                    <span className="num font-semibold" style={{ color: 'var(--fg)' }}>
                      {serviceSummary.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--fg2)' }}>En ligne</span>
                    <span className="num font-semibold" style={{ color: 'var(--success)' }}>
                      {serviceSummary.up}
                    </span>
                  </div>
                  {serviceSummary.down > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--fg2)' }}>Hors ligne</span>
                      <span className="num font-semibold" style={{ color: 'var(--danger)' }}>
                        {serviceSummary.down}
                      </span>
                    </div>
                  )}
                  <div
                    className="rounded-full overflow-hidden mt-1"
                    style={{ height: '5px', background: 'var(--border)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(serviceSummary.up / serviceSummary.total) * 100}%`,
                        background: serviceSummary.down > 0 ? 'var(--warning)' : 'var(--success)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--fg3)' }}>
                  Données non disponibles
                </p>
              )}
            </div>

            {/* Audit stats */}
            <div className="card p-5">
              <p className="font-semibold text-sm mb-4" style={{ color: 'var(--fg)' }}>
                Statistiques d&apos;audit
              </p>
              <div className="flex flex-col gap-2">
                {(['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'TOGGLE'] as const).map((action) => {
                  const count = entries.filter((e) => e.action.startsWith(action)).length;
                  return (
                    <div key={action} className="flex items-center justify-between text-sm">
                      <Badge variant={ACTION_VARIANT[action]}>{action}</Badge>
                      <span className="num font-semibold" style={{ color: 'var(--fg2)' }}>{count}</span>
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
