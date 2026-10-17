'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/shell';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import Spinner from '@/components/ui/spinner';
import {
  MessageCircle, CheckCircle, Clock, XCircle, RefreshCw,
  Wifi, WifiOff, Send, Search, AlertCircle,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
type MsgStatus = 'sent' | 'received' | 'pending' | 'failed' | 'unknown' | 'all';

interface WaMessage {
  id: string;
  to: string;
  body: string;
  status: string;
  channel?: string;
  createdAt?: string;
  created_at?: string;
  from?: string;
}

interface WaData {
  configured: boolean;
  connected: boolean;
  state: string;
  error?: string;
  historyAvailable: boolean;
  channel: { name: string; phone: string; status: string } | null;
  messages: WaMessage[];
  stats: { total: number; sent: number; received: number; pending: number; failed: number; unknown: number };
}

/* ── Helpers ────────────────────────────────────────────────── */
const PAGE_SIZE = 25;

function resolveStatus(raw: string): Exclude<MsgStatus, 'all'> {
  const s = (raw ?? '').toLowerCase();
  if (['delivered', 'read', 'sent'].includes(s)) return 'sent';
  if (['queued', 'pending', 'sending'].includes(s)) return 'pending';
  if (s === 'received') return 'received';
  if (['failed', 'undelivered', 'error'].includes(s)) return 'failed';
  return 'unknown';
}

const STATUS_META = {
  received: { label: 'Reçu', color: 'var(--accent)', bg: 'var(--accent-dim)', icon: <MessageCircle size={11} /> },
  unknown: { label: 'Inconnu', color: 'var(--fg3)', bg: 'var(--bg2)', icon: <AlertCircle size={11} /> },
  sent:    { label: 'Envoyé',     color: 'var(--success)', bg: 'rgba(34,217,110,0.12)',  icon: <CheckCircle size={11} /> },
  pending: { label: 'En attente', color: 'var(--warning)', bg: 'rgba(255,170,0,0.12)',   icon: <Clock size={11} /> },
  failed:  { label: 'Échoué',     color: 'var(--danger)',  bg: 'rgba(255,68,85,0.12)',   icon: <XCircle size={11} /> },
};

function fmtDate(msg: WaMessage) {
  const raw = msg.createdAt ?? msg.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/* ── Page ───────────────────────────────────────────────────── */
export default function WhatsappPage() {
  const [data, setData]         = useState<WaData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [statusTab, setStatusTab] = useState<MsgStatus>('all');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  /* test message */
  const [showTest, setShowTest]   = useState(false);
  const [testTo, setTestTo]       = useState('');
  const [testBody, setTestBody]   = useState('Bonjour ! Ceci est un message test GymPass SN 👋');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult]   = useState<'ok' | 'err' | null>(null);
  const [testError, setTestError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    authenticatedFetch('/api/whatsapp')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Accès administrateur requis. Reconnectez-vous pour consulter WhatsApp.' : 'Impossible de charger les données WhatsApp. Réessayez.');
        return r.json() as Promise<WaData>;
      })
      .then((next) => { setData(next); setError(next.error ?? ''); })
      .catch((failure: unknown) => { setData(null); setError(failure instanceof Error ? failure.message : 'Impossible de charger WhatsApp'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Filtering ── */
  const messages = data?.messages ?? [];
  const filtered = messages.filter((m) => {
    const s = resolveStatus(m.status);
    if (statusTab !== 'all' && s !== statusTab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return m.to.includes(q) || (m.body ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* ── Send test message ── */
  async function sendTest() {
    if (!data?.connected || !testTo.trim() || !testBody.trim() || testSending) return;
    setTestSending(true); setTestResult(null); setTestError('');
    try {
      const r = await authenticatedFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim(), body: testBody }),
      });
      const result = await r.json().catch(() => ({}));
      setTestResult(r.ok ? 'ok' : 'err');
      if (!r.ok) setTestError(result.error || 'Envoi impossible. Vérifiez la connexion WhatsApp et réessayez.');
      if (r.ok) setTimeout(load, 2000);
    } catch { setTestResult('err'); setTestError('Impossible de joindre le serveur. Réessayez.'); }
    finally { setTestSending(false); }
  }

  const configured = data?.configured ?? false;

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">WhatsApp</h1>
            <p className="page-sub">Messagerie via Relayio — historique récent</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowTest((v) => !v); setTestResult(null); }} className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', fontSize: 13, borderRadius: 10 }}>
              <Send size={13} /> Test
            </button>
            <button onClick={load} className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', fontSize: 13, borderRadius: 10 }}>
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
          </div>
        )}

        {/* Connection + stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, alignItems: 'start' }}>

          {/* Connection card */}
          <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: loading ? 'var(--bg2)' : data?.connected ? 'rgba(34,217,110,0.12)' : 'rgba(255,68,85,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: loading ? 'var(--fg3)' : data?.connected ? 'var(--success)' : 'var(--danger)',
              }}>
                {loading ? <Spinner size="sm" /> : data?.connected ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Connexion</div>
                <div style={{ fontSize: 12, color: loading ? 'var(--fg3)' : data?.connected ? 'var(--success)' : 'var(--fg3)', marginTop: 1 }}>
                  {loading ? 'Vérification…' : data?.connected ? 'Connecté' : data?.state === 'auth_error' ? 'Authentification refusée' : data?.state === 'disconnected' ? 'Déconnecté' : data?.configured ? 'Connexion indisponible' : 'Non configuré'}
                </div>
              </div>
            </div>

            {data?.channel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {data.channel.name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--fg3)' }}>Compte</span>
                    <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{data.channel.name}</span>
                  </div>
                )}
                {data.channel.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--fg3)' }}>Numéro</span>
                    <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{data.channel.phone}</span>
                  </div>
                )}
              </div>
            )}

            {!loading && !data?.connected && (
              <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--fg3)', lineHeight: 1.6 }}>
                {data?.error || error || 'Demandez à un administrateur de connecter votre session WhatsApp dans Relayio.'}
              </div>
            )}
          </div>

          {/* Stats chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              { label: 'Historique chargé', value: data?.stats.total ?? 0, color: 'var(--fg2)', icon: <MessageCircle size={13} /> },
              { label: 'Envoyés',      value: data?.stats.sent ?? 0,    color: 'var(--success)', icon: <CheckCircle size={13} /> },
              { label: 'Reçus', value: data?.stats.received ?? 0, color: 'var(--accent)', icon: <MessageCircle size={13} /> },
              { label: 'En attente',    value: data?.stats.pending ?? 0, color: 'var(--warning)', icon: <Clock size={13} /> },
              { label: 'Échoués',       value: data?.stats.failed ?? 0,  color: 'var(--danger)',  icon: <XCircle size={13} /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="section-label">{label}</span>
                  <span style={{ color }}>{icon}</span>
                </div>
                {loading
                  ? <div className="skeleton" style={{ height: 28, width: 50 }} />
                  : <span className="stat-value num" style={{ fontSize: 28, color }}>{data?.historyAvailable ? value : '—'}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Test message panel */}
        {showTest && (
          <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Envoyer un message test</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Destinataire</label>
                <input className="input-base" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                  placeholder="+221 77 000 00 00" style={{ width: '100%', fontSize: 13 }} />
              </div>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: 5 }}>Message</label>
                <input className="input-base" value={testBody} onChange={(e) => setTestBody(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }} />
              </div>
              <button onClick={sendTest} disabled={testSending || !data?.connected || !testTo.trim() || !testBody.trim()} className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', fontSize: 13, borderRadius: 9, opacity: testSending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {testSending ? <Spinner size="sm" /> : <Send size={13} />}
                Envoyer
              </button>
            </div>
            {testResult === 'ok' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--success)', fontSize: 12 }}>
                <CheckCircle size={13} /> Message accepté par Relayio
              </div>
            )}
            {testResult === 'err' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--danger)', fontSize: 12 }}>
                <XCircle size={13} /> {testError}
              </div>
            )}
          </div>
        )}

        {/* Message history */}
        <div className="card" style={{ overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', pointerEvents: 'none' }} />
              <input type="search" className="input-base" placeholder="Numéro ou message…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 30, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border2)', width: '100%' }} />
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)' }}>
              <span className="num" style={{ color: 'var(--fg2)', fontWeight: 600 }}>{filtered.length}</span> message{filtered.length !== 1 ? 's' : ''} — historique récent chargé
            </span>
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
            {([
              { key: 'all' as MsgStatus, label: 'Tous', count: messages.length },
              { key: 'sent' as MsgStatus, label: 'Envoyés', count: data?.stats.sent ?? 0 },
              { key: 'received' as MsgStatus, label: 'Reçus', count: data?.stats.received ?? 0 },
              { key: 'unknown' as MsgStatus, label: 'Inconnus', count: data?.stats.unknown ?? 0 },
              { key: 'pending' as MsgStatus, label: 'En attente', count: data?.stats.pending ?? 0 },
              { key: 'failed' as MsgStatus, label: 'Échoués', count: data?.stats.failed ?? 0 },
            ]).map(({ key, label, count }) => {
              const active = statusTab === key;
              return (
                <button key={key} onClick={() => { setStatusTab(key); setPage(1); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--fg)' : 'var(--fg3)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg2)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}
                >
                  {label}
                  {!loading && (
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, background: active ? 'var(--accent-dim)' : 'var(--border)', color: active ? 'var(--accent)' : 'var(--fg3)', padding: '1px 6px' }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 130px', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div className="skeleton" style={{ height: 10, width: 110 }} />
                  <div className="skeleton" style={{ height: 10 }} />
                  <div className="skeleton" style={{ height: 20, width: 70 }} />
                  <div className="skeleton" style={{ height: 10, width: 110 }} />
                </div>
              ))}
            </div>
          ) : !configured ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg3)' }}>
                <MessageCircle size={22} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg2)' }}>{error ? 'Connexion indisponible' : 'Connexion Relayio non configurée'}</div>
              <div style={{ fontSize: 12, color: 'var(--fg3)' }}>{error || 'Contactez un administrateur pour connecter WhatsApp et consulter les messages.'}</div>
            </div>
          ) : !data?.historyAvailable ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Historique indisponible. Réessayez après avoir vérifié la connexion.</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
              Aucun message trouvé
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Correspondant</th>
                  <th>Message</th>
                  <th style={{ width: 100 }}>Statut</th>
                  <th style={{ width: 140 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((m) => {
                  const s = resolveStatus(m.status);
                  const meta = STATUS_META[s];
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg2)' }}>{m.to}</span>
                      </td>
                      <td style={{ color: 'var(--fg3)', fontSize: 12.5 }}>{truncate(m.body ?? '')}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                          background: meta.bg, color: meta.color,
                        }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td>
                        <span className="num" style={{ fontSize: 11.5, color: 'var(--fg3)' }}>{fmtDate(m)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>← Précédent</button>
              <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
                Page <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{currentPage}</span> / <span className="num">{totalPages}</span>
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>Suivant →</button>
            </div>
          )}
        </div>

      </div>
    </Shell>
  );
}
