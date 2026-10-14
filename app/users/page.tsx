'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { adminApi, Gym, User } from '@/lib/api';

interface UserWithGym extends User { gymNom?: string }

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithGym[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger toutes les salles, puis les users de chaque salle
    adminApi.get('/gym/all').then(async (r) => {
      const gyms: Gym[] = r.data;
      const allUsers: UserWithGym[] = [];
      await Promise.all(
        gyms.map(async (g) => {
          try {
            const res = await adminApi.get(`/users?gymId=${g.id}`);
            const list = Array.isArray(res.data) ? res.data : [];
            list.forEach((u: User) => allUsers.push({ ...u, gymNom: g.nom }));
          } catch { /* salle sans accès */ }
        })
      );
      allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUsers(allUsers);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const roleColor: Record<string, string> = {
    ADMIN: 'var(--accent)',
    GERANT: '#60a5fa',
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {users.length} compte(s) sur toutes les salles
          </p>
        </div>

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Chargement...</div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {['Nom', 'Email', 'Salle', 'Rôle', 'Statut'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card)' }}>
                    <td className="px-4 py-3 font-medium">{u.prenom} {u.nom}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                        {u.gymNom}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: 'var(--muted-bg)', color: roleColor[u.role] ?? 'var(--muted)' }}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${u.actif ? 'text-green-400' : 'text-red-400'}`}
                        style={{ background: 'var(--muted-bg)' }}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
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
