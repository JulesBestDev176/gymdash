'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa, Gym, User } from '@/lib/api';
import { CreditCard, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface Payment {
  id: string;
  type: string;
  formule: string;
  montantFcfa: number;
  mode: string;
  createdAt: string;
  member: { nom: string; prenom: string };
  gymNom?: string;
}

type TabKey = 'abonnements' | 'adherents';

const TYPE_VARIANT: Record<string, 'accent' | 'blue' | 'warning' | 'purple'> = {
  ABONNEMENT:     'accent',
  SEANCE_UNIQUE:  'blue',
  INSCRIPTION:    'warning',
  RECHARGE_CARTE: 'purple',
};

interface GymWithUsers extends Gym {
  userList: User[];
  expanded: boolean;
}

interface PendingConfirm { gymIdx: number; user: User; }
interface UndoToast { message: string; onUndo: () => void; timeoutId: ReturnType<typeof setTimeout>; }

export default function PaymentsPage() {
  const [tab, setTab] = useState<TabKey>('adherents');

  // Adhérents tab state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [gymFilterPay, setGymFilterPay] = useState('');
  const [gymsPay, setGymsPay] = useState<Gym[]>([]);

  // Abonnements tab state
  const [gymUsers, setGymUsers] = useState<GymWithUsers[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Confirmation + undo state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);

  useEffect(() => {
    // Load all gyms + payments
    adminApi.get('/api/v1/gym/all').then(async (r) => {
      const gymList: Gym[] = Array.isArray(r.data) ? r.data : [];
      setGymsPay(gymList);

      // Payments
      const all: Payment[] = [];
      await Promise.all(
        gymList.map(async (g) => {
          try {
            const res = await adminApi.get(`/api/v1/payments?gymId=${g.id}`);
            const list = Array.isArray(res.data) ? res.data : [];
            list.forEach((p: Payment) => all.push({ ...p, gymNom: g.nom }));
          } catch { /* skip */ }
        })
      );
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(all);
      setLoadingPayments(false);

      // Users per gym (for abonnements tab)
      const withUsers: GymWithUsers[] = await Promise.all(
        gymList.map(async (g) => {
          try {
            const res = await adminApi.get(`/api/v1/users?gymId=${g.id}`);
            const userList = Array.isArray(res.data) ? res.data : [];
            return { ...g, userList, expanded: false };
          } catch {
            return { ...g, userList: [], expanded: false };
          }
        })
      );
      setGymUsers(withUsers);
      setLoadingGyms(false);
    }).catch(console.error);
  }, []);

  // ── Payments tab helpers
  const filtered = payments.filter((p) => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (gymFilterPay && p.gymNom !== gymFilterPay) return false;
    return true;
  });
  const total = filtered.reduce((s, p) => s + p.montantFcfa, 0);

  // ── Abonnements: toggle user active
  async function toggleUser(gymIdx: number, u: User) {
    setTogglingId(u.id);
    try {
      await adminApi.patch(`/api/v1/users/${u.id}`, { actif: !u.actif });
      setGymUsers((prev) => prev.map((g, i) => i !== gymIdx ? g : {
        ...g,
        userList: g.userList.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x),
      }));
    } catch (err) { console.error(err); }
    finally { setTogglingId(null); }
  }

  async function toggleAll(gymIdx: number, activate: boolean) {
    const g = gymUsers[gymIdx];
    await Promise.all(
      g.userList.map(async (u) => {
        if (u.actif !== activate) {
          try {
            await adminApi.patch(`/api/v1/users/${u.id}`, { actif: activate });
          } catch { /* skip */ }
        }
      })
    );
    setGymUsers((prev) => prev.map((gx, i) => i !== gymIdx ? gx : {
      ...gx,
      userList: gx.userList.map((u) => ({ ...u, actif: activate })),
    }));
  }

  function toggleExpand(gymIdx: number) {
    setGymUsers((prev) => prev.map((g, i) => i !== gymIdx ? g : { ...g, expanded: !g.expanded }));
  }

  return (
    <Shell>
      {/* Undo toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 100,
          background: 'var(--card2)', border: '1px solid var(--border2)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'fadeUp 0.2s ease both',
          fontSize: 13, color: 'var(--fg)',
        }}>
          <span>{undoToast.message}</span>
          <button
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={undoToast.onUndo}
          >
            Annuler
          </button>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--fg3)', cursor: 'pointer', padding: 4 }}
            onClick={() => { clearTimeout(undoToast.timeoutId); setUndoToast(null); }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-6 fade-up">
        {/* Header */}
        <div>
          <h1 className="page-title">Paiements</h1>
          <p className="page-sub">Gestion des abonnements et paiements adhérents</p>
        </div>

        {/* Tabs */}
        <div className="tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'abonnements'}
            aria-controls="panel-abonnements"
            className={`tab-item${tab === 'abonnements' ? ' active' : ''}`}
            onClick={() => setTab('abonnements')}
          >
            <Users size={13} />
            Abonnements salles
          </button>
          <button
            role="tab"
            aria-selected={tab === 'adherents'}
            aria-controls="panel-adherents"
            className={`tab-item${tab === 'adherents' ? ' active' : ''}`}
            onClick={() => setTab('adherents')}
          >
            <CreditCard size={13} />
            Paiements adhérents
          </button>
        </div>

        {/* ── Abonnements salles ── */}
        {tab === 'abonnements' && (
          <div id="panel-abonnements" role="tabpanel">
            {loadingGyms ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" style={{ color: 'var(--accent)' } as React.CSSProperties} />
              </div>
            ) : gymUsers.length === 0 ? (
              <EmptyState icon={Users} title="Aucune salle disponible" />
            ) : (
              <div className="flex flex-col gap-4">
                {gymUsers.map((g, idx) => (
                  <div key={g.id} className="card overflow-hidden">
                    {/* Gym header */}
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer"
                      style={{ borderBottom: g.expanded ? '1px solid var(--border)' : undefined }}
                      onClick={() => toggleExpand(idx)}
                    >
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{g.nom}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>
                          {g.ville} · <span className="num">{g.userList.length}</span> utilisateur(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.expanded && (
                          <>
                            <button className="btn-success" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); toggleAll(idx, true); }}>
                              Tout activer
                            </button>
                            <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); toggleAll(idx, false); }}>
                              Tout désactiver
                            </button>
                          </>
                        )}
                        {g.expanded ? <ChevronUp size={16} style={{ color: 'var(--fg3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--fg3)' }} />}
                      </div>
                    </div>

                    {g.expanded && (
                      g.userList.length === 0 ? (
                        <div className="px-5 py-6 text-center text-xs" style={{ color: 'var(--fg3)' }}>
                          Aucun utilisateur pour cette salle
                        </div>
                      ) : (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Nom</th>
                              <th>Email</th>
                              <th>Rôle</th>
                              <th>Statut</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.userList.map((u) => (
                              <>
                                <tr key={u.id}>
                                  <td className="font-medium">{u.prenom} {u.nom}</td>
                                  <td style={{ color: 'var(--fg2)' }}>{u.email}</td>
                                  <td><Badge variant={u.role === 'ADMIN' ? 'accent' : 'blue'}>{u.role}</Badge></td>
                                  <td><Badge variant={u.actif ? 'success' : 'danger'}>{u.actif ? 'Actif' : 'Inactif'}</Badge></td>
                                  <td>
                                    <button
                                      className={u.actif ? 'btn-danger' : 'btn-success'}
                                      style={{ padding: '4px 10px', fontSize: '11px' }}
                                      disabled={togglingId === u.id}
                                      onClick={() => setPendingConfirm({ gymIdx: idx, user: u })}
                                    >
                                      {togglingId === u.id
                                        ? <Spinner size="sm" />
                                        : u.actif ? 'Désactiver' : 'Activer'
                                      }
                                    </button>
                                  </td>
                                </tr>
                                {pendingConfirm?.gymIdx === idx && pendingConfirm?.user.id === u.id && (
                                  <tr key={`confirm-${u.id}`}>
                                    <td colSpan={5} style={{ background: 'var(--warning-dim)', padding: '8px 20px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                                        <span style={{ color: 'var(--fg2)' }}>
                                          {pendingConfirm.user.actif ? 'Désactiver' : 'Activer'} {pendingConfirm.user.prenom} {pendingConfirm.user.nom} ?
                                        </span>
                                        <button className="btn-danger" style={{ padding: '3px 10px', fontSize: '11px' }}
                                          onClick={async () => {
                                            const { gymIdx: gi, user: u2 } = pendingConfirm;
                                            setPendingConfirm(null);
                                            await toggleUser(gi, u2);
                                            const prev = u2.actif;
                                            const timeoutId = setTimeout(() => setUndoToast(null), 10000);
                                            setUndoToast({
                                              message: `${u2.prenom} ${u2.nom} ${prev ? 'désactivé' : 'activé'}`,
                                              onUndo: async () => {
                                                clearTimeout(timeoutId);
                                                setUndoToast(null);
                                                await toggleUser(gi, { ...u2, actif: !u2.actif });
                                              },
                                              timeoutId,
                                            });
                                          }}
                                        >
                                          Confirmer
                                        </button>
                                        <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: '11px' }}
                                          onClick={() => setPendingConfirm(null)}
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Paiements adhérents ── */}
        {tab === 'adherents' && (
          <div id="panel-adherents" role="tabpanel">
            {/* Filters + total */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filtrer par salle"
                className="input-base"
                style={{ width: 'auto', minWidth: '160px' }}
                value={gymFilterPay}
                onChange={(e) => setGymFilterPay(e.target.value)}
              >
                <option value="">Toutes les salles</option>
                {gymsPay.map((g) => (
                  <option key={g.id} value={g.nom}>{g.nom}</option>
                ))}
              </select>
              <select
                aria-label="Filtrer par type"
                className="input-base"
                style={{ width: 'auto', minWidth: '160px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Tous les types</option>
                <option value="ABONNEMENT">Abonnement</option>
                <option value="SEANCE_UNIQUE">Séance unique</option>
                <option value="INSCRIPTION">Inscription</option>
                <option value="RECHARGE_CARTE">Recharge carte</option>
              </select>
              <div className="ml-auto flex flex-col items-end">
                <span className="section-label">Total filtré</span>
                <span className="num font-bold" style={{ color: 'var(--accent)', fontSize: '15px' }}>
                  {fmtFcfa(total)}
                </span>
              </div>
            </div>

            {loadingPayments ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" style={{ color: 'var(--accent)' } as React.CSSProperties} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Aucun paiement trouvé"
                subtitle="Modifiez les filtres pour afficher des résultats"
              />
            ) : (
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Adhérent</th>
                      <th>Salle</th>
                      <th>Type</th>
                      <th>Montant</th>
                      <th>Mode</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.member?.prenom} {p.member?.nom}</td>
                        <td><Badge variant="neutral">{p.gymNom}</Badge></td>
                        <td><Badge variant={TYPE_VARIANT[p.type] ?? 'neutral'}>{p.formule}</Badge></td>
                        <td>
                          <span className="num font-semibold" style={{ color: 'var(--accent)' }}>
                            {fmtFcfa(p.montantFcfa)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--fg2)' }}>{p.mode}</td>
                        <td style={{ color: 'var(--fg2)' }}>
                          {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
