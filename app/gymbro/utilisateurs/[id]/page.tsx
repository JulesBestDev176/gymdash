'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { adminApi, fmtFcfa } from '@/lib/api';
import {
  ArrowLeft, UserCircle, Award, Mail, Phone, Calendar,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  ShieldCheck, ShieldOff, CreditCard,
  Target, Dumbbell, Clock, Activity, Scale,
  TrendingUp, BarChart2, ListVideo, ChevronRight,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */

interface GymbroSubscription {
  id: string; dateDebut: string; dateExpiration: string;
  statut: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  montantFcfa: number; note?: string;
}

interface GymbroProfile {
  objectifPrincipal?: string; objectifSecondaire?: string; descriptionPhysique?: string;
  age?: number; tailleCm?: number; poidsKg?: number; poidsSouhaiteKg?: number;
  seancesParSemaine?: number; dureeMaxSeanceMin?: number; joursPreferesJson?: string;
  niveauExperience?: string; typeEquipement?: string; preferenceEquipement?: string;
  douleurs?: string; blessures?: string; heuresSommeil?: number; niveauFatigue?: number;
  restrictionMedicale?: boolean; questionnaireComplet: boolean; matchingStatus?: string;
  performancesJson?: string;
}

interface UserProgram {
  id: string; actif: boolean; dateDebut: string; dateFin?: string;
  program: { id: string; nom: string; objectif: string; nbSemaines: number; seancesParSemaine: number; niveauMin: string; niveauMax: string };
  sessions: { statut: string }[];
}

interface WeightLog { id: string; poidsKg: number; date: string; note?: string; }

interface Bilan {
  id: string; semaine: number; seancesTotal: number; seancesReussies: number;
  volumeTotal?: number; poidsDebut?: number; poidsFin?: number; notes?: string;
}

interface GymbroUserDetail {
  id: string; nom: string; prenom: string; email: string;
  telephone?: string; role: 'USER' | 'COACH'; actif: boolean; createdAt: string;
  subscriptions?: GymbroSubscription[];
  profile?: GymbroProfile;
  userPrograms?: UserProgram[];
  weightLogs?: WeightLog[];
  bilans?: Bilan[];
}

/* ── Helpers ────────────────────────────────────────────────── */

const SUB_META: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Actif',       cls: 'badge badge-success' },
  EXPIRED:   { label: 'Expiré',      cls: 'badge badge-neutral' },
  CANCELLED: { label: 'Annulé',      cls: 'badge badge-danger'  },
  PENDING:   { label: 'En attente',  cls: 'badge badge-warning' },
};

const OBJECTIF_LABELS: Record<string, string> = {
  PRISE_DE_MASSE: 'Prise de masse', FORCE: 'Force',
  REMISE_EN_FORME: 'Remise en forme', AUTRE: 'Autre',
};
const NIVEAU_LABELS: Record<string, string> = {
  DEBUTANT: 'Débutant', QUELQUES_MOIS: 'Quelques mois',
  PLUS_D_UN_AN: 'Plus d\'1 an', INTERMEDIAIRE: 'Intermédiaire',
};
const EQUIPEMENT_LABELS: Record<string, string> = {
  FULL_GYM: 'Salle complète', HALTERES_SEULEMENT: 'Haltères seulement',
  POIDS_DE_CORPS: 'Poids de corps', BARRE_ET_HALTERES: 'Barre + haltères',
  HALTERES_BARRES: 'Haltères + barres', MIXTE: 'Mixte',
};
const SESSION_STATUT_META: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Faite',     color: 'var(--success)' },
  SKIPPED:   { label: 'Sautée',    color: 'var(--warning)' },
  PLANNED:   { label: 'Planifiée', color: 'var(--fg3)'     },
  IN_PROGRESS: { label: 'En cours', color: '#38bdf8'       },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isExpired(iso: string) { return new Date(iso) < new Date(); }
function daysUntil(iso: string) { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); }

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--fg3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--fg)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--fg3)' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function GymbroUserDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const userId  = typeof params.id === 'string' ? params.id : '';

  const [user, setUser]         = useState<GymbroUserDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toggling, setToggling] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true); setError('');
    adminApi.get(`/api/v1/gym/gymbro-users/${userId}`)
      .then((r) => setUser(r.data))
      .catch(() => setError('Impossible de charger le profil'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function toggleActif() {
    if (!user) return;
    setToggling(true);
    try {
      await adminApi.patch(`/api/v1/gym/gymbro-user/${user.id}/toggle-actif`);
      setUser((u) => u ? { ...u, actif: !u.actif } : u);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  }

  const activeSub    = (user?.subscriptions ?? []).find((s) => s.statut === 'ACTIVE' && !isExpired(s.dateExpiration));
  const activeProgram = (user?.userPrograms ?? []).find((p) => p.actif);
  const latestWeight = (user?.weightLogs ?? []).at(-1);
  const firstWeight  = (user?.weightLogs ?? []).at(0);
  const p = user?.profile;

  /* sessions stats on active program */
  const sessionStats = activeProgram ? {
    total:     activeProgram.sessions.length,
    done:      activeProgram.sessions.filter((s) => s.statut === 'COMPLETED').length,
    skipped:   activeProgram.sessions.filter((s) => s.statut === 'SKIPPED').length,
    planned:   activeProgram.sessions.filter((s) => s.statut === 'PLANNED').length,
  } : null;

  const completionPct = sessionStats && sessionStats.total > 0
    ? Math.round((sessionStats.done / sessionStats.total) * 100)
    : 0;

  const weightDelta = latestWeight && firstWeight && latestWeight.id !== firstWeight.id
    ? +(latestWeight.poidsKg - firstWeight.poidsKg).toFixed(1)
    : null;

  return (
    <Shell>
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Back */}
        <button
          onClick={() => router.push('/gymbro/utilisateurs')}
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '6px 10px', width: 'fit-content' }}
        >
          <ArrowLeft size={13} /> Retour aux utilisateurs
        </button>

        {/* ── Header ─────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: 200, height: 18 }} />
              <div className="skeleton" style={{ width: 140, height: 12 }} />
            </div>
          </div>
        ) : user ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: user.role === 'COACH' ? 'rgba(255,170,0,0.12)' : 'rgba(130,100,255,0.12)',
              border: `1px solid ${user.role === 'COACH' ? 'rgba(255,170,0,0.2)' : 'rgba(130,100,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: user.role === 'COACH' ? 'var(--warning)' : '#8264ff',
            }}>
              {user.role === 'COACH' ? <Award size={22} /> : <UserCircle size={22} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--fg)', lineHeight: 1.2 }}>
                  {user.prenom} {user.nom}
                </h1>
                {user.role === 'COACH' && <span className="badge badge-warning" style={{ fontSize: 10.5 }}>Coach</span>}
                <span className={user.actif ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: 10.5 }}>
                  {user.actif ? 'Actif' : 'Inactif'}
                </span>
                {p?.questionnaireComplet
                  ? <span className="badge badge-accent" style={{ fontSize: 10.5 }}>Profil complet</span>
                  : <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>Profil incomplet</span>}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg3)' }}>Inscrit le {fmtDate(user.createdAt)}</p>
            </div>
            <button
              onClick={toggleActif} disabled={toggling}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: user.actif ? 'var(--danger-dim)' : 'var(--success-dim)',
                color: user.actif ? 'var(--danger)' : 'var(--success)',
                opacity: toggling ? 0.5 : 1,
              }}
            >
              {toggling ? <Spinner size="sm" /> : user.actif ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
              {user.actif ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ) : null}

        {error && (
          <div className="banner-error" role="alert">
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {!loading && user && (
          <>
            {/* ── Row 1: KPI chips ─────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {/* Abonnement */}
              <div className={activeSub ? 'card-accent' : 'card'} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="section-label">Abonnement</span>
                {activeSub ? (
                  <>
                    <span className="stat-value stat-value-accent num" style={{ fontSize: 18 }}>Actif</span>
                    <span style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.8 }}>
                      expire {fmtDateShort(activeSub.dateExpiration)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="stat-value num" style={{ fontSize: 18, color: 'var(--fg3)' }}>Inactif</span>
                    <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{(user.subscriptions ?? []).length} passé{(user.subscriptions ?? []).length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>

              {/* Programme */}
              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="section-label">Programme</span>
                {activeProgram ? (
                  <>
                    <span className="stat-value num" style={{ fontSize: 16, color: 'var(--fg)', lineHeight: 1.3 }}>{activeProgram.program.nom}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{activeProgram.program.nbSemaines} sem · {activeProgram.program.seancesParSemaine}×/sem</span>
                  </>
                ) : (
                  <span className="stat-value num" style={{ fontSize: 18, color: 'var(--fg3)' }}>—</span>
                )}
              </div>

              {/* Complétion */}
              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="section-label">Séances faites</span>
                {sessionStats ? (
                  <>
                    <span className="stat-value num" style={{ fontSize: 22, color: 'var(--success)' }}>
                      {sessionStats.done}<span style={{ fontSize: 13, color: 'var(--fg3)', fontWeight: 400 }}>/{sessionStats.total}</span>
                    </span>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ height: '100%', width: `${completionPct}%`, background: 'var(--success)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{completionPct}% complété</span>
                  </>
                ) : (
                  <span className="stat-value num" style={{ fontSize: 22, color: 'var(--fg3)' }}>—</span>
                )}
              </div>

              {/* Poids actuel */}
              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="section-label">Poids actuel</span>
                {latestWeight ? (
                  <>
                    <span className="stat-value num" style={{ fontSize: 22, color: 'var(--fg)' }}>
                      {latestWeight.poidsKg} <span style={{ fontSize: 13, color: 'var(--fg3)', fontWeight: 400 }}>kg</span>
                    </span>
                    {weightDelta !== null && (
                      <span style={{ fontSize: 11, color: weightDelta < 0 ? 'var(--success)' : weightDelta > 0 ? 'var(--warning)' : 'var(--fg3)', fontWeight: 600 }}>
                        {weightDelta > 0 ? '+' : ''}{weightDelta} kg depuis le début
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="stat-value num" style={{ fontSize: 22, color: 'var(--fg3)' }}>{p?.poidsKg ? `${p.poidsKg} kg` : '—'}</span>
                    {p?.poidsKg && <span style={{ fontSize: 11, color: 'var(--fg3)' }}>saisie initiale</span>}
                  </>
                )}
              </div>
            </div>

            {/* ── Row 2: Coordonnées + Programme actif ─────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>

              {/* Coordonnées */}
              <SectionCard title="Coordonnées" icon={<Mail size={14} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <ProfileRow label="Email" value={user.email} />
                  <ProfileRow label="Téléphone" value={user.telephone} />
                  <ProfileRow label="Inscrit le" value={fmtDateShort(user.createdAt)} />
                  <ProfileRow label="Rôle" value={
                    <span className={user.role === 'COACH' ? 'badge badge-warning' : 'badge badge-neutral'} style={{ fontSize: 10 }}>
                      {user.role === 'COACH' ? 'Coach' : 'Utilisateur'}
                    </span>
                  } />
                </div>
              </SectionCard>

              {/* Programme actif */}
              <SectionCard title="Programme actif" icon={<ListVideo size={14} />}>
                {activeProgram ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)', marginBottom: 3 }}>{activeProgram.program.nom}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>{OBJECTIF_LABELS[activeProgram.program.objectif] ?? activeProgram.program.objectif}</span>
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                            {NIVEAU_LABELS[activeProgram.program.niveauMin] ?? activeProgram.program.niveauMin}
                          </span>
                        </div>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: 10, flexShrink: 0 }}>En cours</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Durée', val: `${activeProgram.program.nbSemaines} sem.` },
                        { label: 'Séances/sem', val: `${activeProgram.program.seancesParSemaine}×` },
                        { label: 'Début', val: fmtDateShort(activeProgram.dateDebut) },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginBottom: 3 }}>{label}</div>
                          <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Sessions breakdown */}
                    {sessionStats && sessionStats.total > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--fg3)' }}>
                          <span>Progression</span>
                          <span className="num" style={{ color: 'var(--fg2)', fontWeight: 700 }}>{completionPct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${completionPct}%`, background: 'var(--success)', borderRadius: 6, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                          {[
                            { label: 'Faites', val: sessionStats.done, color: 'var(--success)' },
                            { label: 'Sautées', val: sessionStats.skipped, color: 'var(--warning)' },
                            { label: 'Planifiées', val: sessionStats.planned, color: 'var(--fg3)' },
                          ].map(({ label, val, color }) => (
                            <span key={label} style={{ color: 'var(--fg3)' }}>
                              <span className="num" style={{ color, fontWeight: 700 }}>{val}</span> {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--fg3)', fontSize: 13 }}>
                    <ListVideo size={24} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    Aucun programme actif
                    {p?.matchingStatus === 'PENDING' && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--warning)' }}>Matching en attente…</div>
                    )}
                    {p?.matchingStatus === 'NO_MATCH' && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger)' }}>Aucun match trouvé</div>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Row 3: Questionnaire ─────────────────────── */}
            {p ? (
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={14} style={{ color: 'var(--fg3)' }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>Questionnaire d'inscription</span>
                  </div>
                  <span className={p.questionnaireComplet ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 10 }}>
                    {p.questionnaireComplet ? 'Complété' : 'Incomplet'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>

                  {/* Objectif */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Objectif</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <ProfileRow label="Objectif principal" value={p.objectifPrincipal ? (OBJECTIF_LABELS[p.objectifPrincipal] ?? p.objectifPrincipal) : undefined} />
                      <ProfileRow label="Objectif secondaire" value={p.objectifSecondaire ? (OBJECTIF_LABELS[p.objectifSecondaire] ?? p.objectifSecondaire) : undefined} />
                      <ProfileRow label="Description" value={p.descriptionPhysique} />
                    </div>
                  </div>

                  {/* Profil physique */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Profil physique</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <ProfileRow label="Âge" value={p.age ? `${p.age} ans` : undefined} />
                      <ProfileRow label="Taille" value={p.tailleCm ? `${p.tailleCm} cm` : undefined} />
                      <ProfileRow label="Poids initial" value={p.poidsKg ? `${p.poidsKg} kg` : undefined} />
                      <ProfileRow label="Poids souhaité" value={p.poidsSouhaiteKg ? `${p.poidsSouhaiteKg} kg` : undefined} />
                    </div>
                  </div>

                  {/* Disponibilités */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Disponibilités</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <ProfileRow label="Séances / semaine" value={p.seancesParSemaine} />
                      <ProfileRow label="Durée max séance" value={p.dureeMaxSeanceMin ? `${p.dureeMaxSeanceMin} min` : undefined} />
                      {p.joursPreferesJson && (() => {
                        try {
                          const jours = JSON.parse(p.joursPreferesJson) as string[];
                          return <ProfileRow label="Jours préférés" value={jours.join(', ')} />;
                        } catch { return null; }
                      })()}
                    </div>
                  </div>

                  {/* Niveau & matériel */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Niveau & matériel</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <ProfileRow label="Expérience" value={p.niveauExperience ? (NIVEAU_LABELS[p.niveauExperience] ?? p.niveauExperience) : undefined} />
                      <ProfileRow label="Équipement" value={p.typeEquipement ? (EQUIPEMENT_LABELS[p.typeEquipement] ?? p.typeEquipement) : undefined} />
                      <ProfileRow label="Préférence" value={p.preferenceEquipement} />
                    </div>
                  </div>

                  {/* Santé */}
                  <div>
                    <div className="section-label" style={{ marginBottom: 8 }}>Santé & récupération</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <ProfileRow label="Douleurs" value={p.douleurs} />
                      <ProfileRow label="Blessures" value={p.blessures} />
                      <ProfileRow label="Heures de sommeil" value={p.heuresSommeil ? `${p.heuresSommeil}h` : undefined} />
                      <ProfileRow label="Niveau fatigue" value={p.niveauFatigue ? `${p.niveauFatigue}/5` : undefined} />
                      <ProfileRow label="Restriction médicale" value={p.restrictionMedicale === true ? 'Oui' : p.restrictionMedicale === false ? 'Non' : undefined} />
                    </div>
                  </div>

                  {/* Performances */}
                  {p.performancesJson && (() => {
                    try {
                      const perfs = JSON.parse(p.performancesJson) as Record<string, number>;
                      const entries = Object.entries(perfs).filter(([, v]) => v);
                      if (!entries.length) return null;
                      return (
                        <div>
                          <div className="section-label" style={{ marginBottom: 8 }}>Performances initiales</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {entries.map(([ex, charge]) => (
                              <ProfileRow key={ex} label={ex} value={`${charge} kg`} />
                            ))}
                          </div>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--fg3)' }}>
                <Target size={24} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13 }}>Questionnaire non rempli</div>
              </div>
            )}

            {/* ── Row 4: Évolution poids + Bilans ──────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, alignItems: 'start' }}>

              {/* Évolution du poids */}
              <SectionCard title="Évolution du poids" icon={<Scale size={14} />}>
                {(user.weightLogs ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--fg3)', fontSize: 13 }}>
                    Aucune pesée enregistrée
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 220, overflowY: 'auto' }}>
                    {[...(user.weightLogs ?? [])].reverse().map((log, i) => {
                      const wl = user.weightLogs ?? [];
                      const prev = wl[wl.length - 2 - i];
                      const delta = prev ? +(log.poidsKg - prev.poidsKg).toFixed(1) : null;
                      return (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{fmtDateShort(log.date)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {delta !== null && delta !== 0 && (
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: delta < 0 ? 'var(--success)' : 'var(--warning)' }}>
                                {delta > 0 ? '+' : ''}{delta} kg
                              </span>
                            )}
                            <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{log.poidsKg} kg</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Bilans */}
              <SectionCard title="Bilans de progression" icon={<BarChart2 size={14} />}>
                {(user.bilans ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--fg3)', fontSize: 13 }}>
                    Aucun bilan généré
                  </div>
                ) : (
                  <div style={{ overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Sem.</th>
                          <th style={{ textAlign: 'center' }}>Séances</th>
                          <th style={{ textAlign: 'center' }}>Taux</th>
                          <th style={{ textAlign: 'right' }}>Volume</th>
                          <th style={{ textAlign: 'right' }}>Poids fin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(user.bilans ?? []).map((b) => {
                          const taux = b.seancesTotal > 0 ? Math.round((b.seancesReussies / b.seancesTotal) * 100) : 0;
                          return (
                            <tr key={b.id}>
                              <td><span className="num" style={{ fontWeight: 700 }}>S{b.semaine}</span></td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="num">{b.seancesReussies}</span>
                                <span style={{ color: 'var(--fg3)' }}>/{b.seancesTotal}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="num" style={{ color: taux >= 80 ? 'var(--success)' : taux >= 50 ? 'var(--warning)' : 'var(--danger)', fontWeight: 700 }}>{taux}%</span>
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--fg2)' }}>
                                {b.volumeTotal ? <span className="num">{Math.round(b.volumeTotal).toLocaleString('fr-FR')} kg</span> : '—'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--fg2)' }}>
                                {b.poidsFin ? <span className="num">{b.poidsFin} kg</span> : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Row 5: Historique abonnements ────────────── */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={13} style={{ color: 'var(--fg3)' }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>Historique des abonnements</span>
                <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg3)', fontWeight: 600 }}>
                  {(user.subscriptions ?? []).length}
                </span>
              </div>
              {(user.subscriptions ?? []).length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>
                  Aucun abonnement enregistré
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Montant</th>
                      <th>Début</th>
                      <th>Expiration</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(user.subscriptions ?? []).map((s) => {
                      const expired = isExpired(s.dateExpiration);
                      const effectiveStatut = expired && s.statut === 'ACTIVE' ? 'EXPIRED' : s.statut;
                      const meta = SUB_META[effectiveStatut];
                      const days = !expired ? daysUntil(s.dateExpiration) : null;
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>
                            <span className="num" style={{ color: expired ? 'var(--fg3)' : 'var(--accent)' }}>{fmtFcfa(s.montantFcfa)}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--fg2)' }}>{fmtDateShort(s.dateDebut)}</td>
                          <td style={{ fontSize: 12, color: expired ? 'var(--fg3)' : 'var(--fg2)' }}>
                            {fmtDateShort(s.dateExpiration)}
                            {days !== null && days <= 7 && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--warning)', fontWeight: 700 }}>J-{days}</span>}
                          </td>
                          <td>
                            {meta ? <span className={meta.cls} style={{ fontSize: 10 }}>{meta.label}</span> : effectiveStatut}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[0,1,2,3].map((i) => <div key={i} className="card" style={{ height: 80 }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
              <div className="card" style={{ height: 120 }} />
              <div className="card" style={{ height: 120 }} />
            </div>
            <div className="card" style={{ height: 220 }} />
          </div>
        )}

      </div>
    </Shell>
  );
}
