'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/shell';
import { adminApi, api, fmtFcfa, Gym, User } from '@/lib/api';
import { ArrowLeft, UserPlus } from 'lucide-react';

interface Payment {
  id: string;
  type: string;
  formule: string;
  montantFcfa: number;
  createdAt: string;
  member: { nom: string; prenom: string };
}

export default function GymDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<'stats' | 'users' | 'payments'>('stats');
  const [gym, setGym] = useState<Gym | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trouver le gym par slug dans la liste
    adminApi.get('/gym/all').then((r) => {
      const found = r.data.find((g: Gym) => g.slug === slug);
      setGym(found ?? null);
      if (found) {
        // Charger users et paiements avec JWT (en tant qu'admin de la salle)
        // Pour GymDash on utilise adminApi avec gymId en query
        return Promise.all([
          adminApi.get(`/users?gymId=${found.id}`).catch(() => ({ data: [] })),
          adminApi.get(`/payments?gymId=${found.id}`).catch(() => ({ data: [] })),
        ]);
      }
    }).then((results) => {
      if (results) {
        setUsers(results[0].data || []);
        setPayments(results[1].data || []);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'text-black' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
    }`;

  if (loading) return <Shell><div className="text-sm" style={{ color: 'var(--muted)' }}>Chargement...</div></Shell>;
  if (!gym) return <Shell><div className="text-sm" style={{ color: 'var(--danger)' }}>Salle introuvable</div></Shell>;

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/gyms" className="p-2 rounded-lg hover:bg-[var(--muted-bg)] transition-colors">
            <ArrowLeft size={18} style={{ color: 'var(--muted)' }} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{gym.nom}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {gym.ville}, {gym.pays} · {gym.nbAdherents ?? 0} adhérents
            </p>
          </div>
        </div>

        {/* KPIs rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Adhérents', value: gym.nbAdherents ?? 0 },
            { label: 'Revenu mois', value: fmtFcfa(gym.revenuMois ?? 0) },
            { label: 'Mensualité', value: fmtFcfa(gym.prixMensualite) },
            { label: 'Séance', value: fmtFcfa(gym.prixSeance) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
              <div className="font-semibold text-sm">{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: 'var(--muted-bg)' }}>
          {(['stats', 'users', 'payments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tabCls(t)}
              style={tab === t ? { background: 'var(--accent)' } : {}}
            >
              {t === 'stats' ? 'Infos' : t === 'users' ? 'Utilisateurs' : 'Paiements'}
            </button>
          ))}
        </div>

        {/* Contenu tabs */}
        {tab === 'stats' && (
          <div className="rounded-xl p-5 border space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
            <h3 className="font-semibold">Informations</h3>
            {[
              ['Nom', gym.nom], ['Slug', gym.slug], ['Ville', gym.ville], ['Pays', gym.pays],
              ["Frais d'inscription", fmtFcfa(gym.fraisInscription)],
              ['Prix mensualité', fmtFcfa(gym.prixMensualite)],
              ['Durée mensualité', `${gym.dureeMensualite} jours`],
              ['Prix séance', fmtFcfa(gym.prixSeance)],
              ['Anti double scan', `${gym.antiDoubleScanSec}s`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Link
                href={`/gyms/${slug}/users/new`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'black' }}
              >
                <UserPlus size={14} /> Nouvel utilisateur
              </Link>
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                    {['Nom', 'Email', 'Rôle', 'Statut'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                        Aucun utilisateur
                      </td>
                    </tr>
                  ) : users.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card)' }}>
                      <td className="px-4 py-3 font-medium">{u.prenom} {u.nom}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: 'var(--muted-bg)', color: 'var(--accent)' }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.actif ? 'text-green-400' : 'text-red-400'}`}
                          style={{ background: 'var(--muted-bg)' }}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {['Adhérent', 'Formule', 'Montant', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                      Aucun paiement
                    </td>
                  </tr>
                ) : payments.slice(0, 20).map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card)' }}>
                    <td className="px-4 py-3 font-medium">{p.member.prenom} {p.member.nom}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{p.formule}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>
                      {fmtFcfa(p.montantFcfa)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
