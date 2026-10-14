'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { adminApi, fmtFcfa, Gym } from '@/lib/api';

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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    adminApi.get('/gym/all').then(async (r) => {
      const gyms: Gym[] = r.data;
      const all: Payment[] = [];
      await Promise.all(
        gyms.map(async (g) => {
          try {
            const res = await adminApi.get(`/payments?gymId=${g.id}`);
            const list = Array.isArray(res.data) ? res.data : [];
            list.forEach((p: Payment) => all.push({ ...p, gymNom: g.nom }));
          } catch { /* skip */ }
        })
      );
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(all);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? payments.filter((p) => p.type === filter)
    : payments;

  const total = filtered.reduce((s, p) => s + p.montantFcfa, 0);

  const typeColor: Record<string, string> = {
    ABONNEMENT: 'var(--accent)',
    SEANCE_UNIQUE: '#60a5fa',
    INSCRIPTION: '#f59e0b',
    RECHARGE_CARTE: '#a78bfa',
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paiements</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              {filtered.length} paiement(s) · {fmtFcfa(total)}
            </p>
          </div>

          <select
            className="px-4 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="ABONNEMENT">Abonnement</option>
            <option value="SEANCE_UNIQUE">Séance unique</option>
            <option value="INSCRIPTION">Inscription</option>
            <option value="RECHARGE_CARTE">Recharge carte</option>
          </select>
        </div>

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Chargement...</div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {['Adhérent', 'Salle', 'Type', 'Montant', 'Mode', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card)' }}>
                    <td className="px-4 py-3 font-medium">{p.member?.prenom} {p.member?.nom}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                        {p.gymNom}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: 'var(--muted-bg)', color: typeColor[p.type] ?? 'var(--muted)' }}>
                        {p.formule}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>
                      {fmtFcfa(p.montantFcfa)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{p.mode}</td>
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
