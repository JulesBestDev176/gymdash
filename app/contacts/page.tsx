'use client';
import { useEffect, useState, useMemo } from 'react';
import Shell from '@/components/shell';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, ContactLead } from '@/lib/api';
import {
  MessageCircle, MapPin, Phone, Calendar,
  Trash2, RefreshCw, AlertCircle, Search,
} from 'lucide-react';

/* ── component ────────────────────────────────────────── */
export default function ContactsPage() {
  const [leads, setLeads]       = useState<ContactLead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError('');
    adminApi.get('/api/v1/contact')
      .then((r) => setLeads(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Impossible de charger les demandes de démo'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(lead: ContactLead) {
    if (!confirm(`Supprimer la demande de ${lead.gym} (${lead.city}) ?`)) return;
    setDeletingId(lead.id);
    try {
      await adminApi.delete(`/api/v1/contact/${lead.id}`);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch {
      alert('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeletingId(null);
    }
  }

  /* ── filtered list ──────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.gym.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q),
    );
  }, [leads, search]);

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ══ HEADER ══════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 2,
            }}>
              <MessageCircle size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="page-title">Demandes de démo</h1>
              <p className="page-sub">
                {loading
                  ? <span style={{ opacity: 0.4 }}>Chargement…</span>
                  : <><span className="num">{leads.length}</span> demande{leads.length !== 1 ? 's' : ''} reçue{leads.length !== 1 ? 's' : ''}</>
                }
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="btn-ghost"
            style={{ flexShrink: 0 }}
            disabled={loading}
            aria-label="Rafraîchir"
          >
            <RefreshCw size={13} style={{ transition: 'transform .4s', transform: loading ? 'rotate(360deg)' : 'none' }} />
            Actualiser
          </button>
        </div>

        {/* ══ ERROR BANNER ════════════════════════════════ */}
        {error && (
          <div
            role="alert"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px', borderRadius: 10,
              background: 'rgba(255,68,85,0.08)',
              border: '1px solid rgba(255,68,85,0.22)',
              color: 'var(--danger)', fontSize: 13,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--fg)' }}>{error}</span>
            <button
              onClick={load}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, padding: '4px 8px',
                borderRadius: 6, transition: 'opacity .15s',
              }}
            >
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {/* ══ SKELETON ════════════════════════════════════ */}
        {loading && (
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card)',
          }}>
            {/* Skeleton header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 150px 120px 40px',
              gap: 0,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--card2)',
            }}>
              {['Salle', 'Ville', 'Téléphone', 'Date', ''].map((col, i) => (
                <span key={i} className="section-label" style={{ textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{col}</span>
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 150px 120px 40px',
                gap: 0,
                padding: '14px 20px',
                alignItems: 'center',
                borderBottom: i === 4 ? 'none' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 12, width: 140 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className="skeleton" style={{ height: 10, width: 80 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className="skeleton" style={{ height: 10, width: 100 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className="skeleton" style={{ height: 10, width: 70 }} />
                </div>
                <div />
              </div>
            ))}
          </div>
        )}

        {/* ══ SEARCH BAR (only when data loaded) ══════════ */}
        {!loading && !error && leads.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--fg3)', pointerEvents: 'none',
              }} />
              <input
                type="search"
                className="input-base"
                placeholder="Rechercher par salle, ville ou téléphone…"
                aria-label="Rechercher une demande"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingLeft: 32, fontSize: 13,
                  background: 'var(--bg2)', border: '1px solid var(--border2)',
                }}
              />
            </div>
            {search && (
              <span style={{ fontSize: 11.5, color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                <span className="num" style={{ color: 'var(--fg2)' }}>{filtered.length}</span> résultat{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* ══ EMPTY: no leads at all ══════════════════════ */}
        {!loading && !error && leads.length === 0 && (
          <EmptyState
            icon={MessageCircle}
            title="Aucune demande de démo"
            subtitle="Les prospects qui remplissent le formulaire apparaîtront ici"
          />
        )}

        {/* ══ EMPTY: search has no results ════════════════ */}
        {!loading && !error && leads.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="Aucun résultat"
            subtitle="Essayez d'autres termes de recherche"
            action={
              <button className="btn-ghost" onClick={() => setSearch('')}>
                Effacer la recherche
              </button>
            }
          />
        )}

        {/* ══ TABLE ════════════════════════════════════════ */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 160px 130px 48px',
              gap: 0,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--card2)',
            }}>
              <span className="section-label">Salle</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Ville</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Téléphone</span>
              <span className="section-label" style={{ textAlign: 'right' }}>Date</span>
              <span className="section-label" style={{ textAlign: 'center' }}>Actions</span>
            </div>

            {/* Rows */}
            {filtered.map((lead, idx) => {
              const isLast = idx === filtered.length - 1;
              const isDeleting = deletingId === lead.id;
              const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}`;
              return (
                <div
                  key={lead.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 160px 130px 48px',
                    gap: 0,
                    padding: '13px 20px',
                    alignItems: 'center',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    opacity: isDeleting ? 0.5 : 1,
                    transition: 'background .15s, opacity .2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Salle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{
                      fontSize: 13.5, fontWeight: 600, color: 'var(--fg)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {lead.gym}
                    </span>
                  </div>

                  {/* Ville */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
                    fontSize: 12.5, color: 'var(--fg2)',
                  }}>
                    <MapPin size={11} style={{ color: 'var(--fg3)', flexShrink: 0 }} strokeWidth={2} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.city}
                    </span>
                  </div>

                  {/* Téléphone */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                    <Phone size={11} style={{ color: 'var(--fg3)', flexShrink: 0 }} strokeWidth={2} />
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="num"
                      style={{
                        fontSize: 12.5, color: 'var(--success)',
                        textDecoration: 'none', fontWeight: 600,
                        letterSpacing: '0.01em',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      title={`Ouvrir WhatsApp avec ${lead.gym}`}
                    >
                      {lead.phone}
                    </a>
                  </div>

                  {/* Date */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
                    fontSize: 12, color: 'var(--fg3)',
                  }}>
                    <Calendar size={11} style={{ flexShrink: 0 }} strokeWidth={2} />
                    <span>{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleDelete(lead)}
                      disabled={isDeleting}
                      aria-label={`Supprimer la demande de ${lead.gym}`}
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--fg3)',
                        transition: 'all .15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isDeleting) {
                          e.currentTarget.style.background = 'rgba(255,68,85,0.1)';
                          e.currentTarget.style.borderColor = 'rgba(255,68,85,0.3)';
                          e.currentTarget.style.color = 'var(--danger)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--fg3)';
                      }}
                    >
                      {isDeleting
                        ? <Spinner size="sm" label="Suppression en cours" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </Shell>
  );
}
