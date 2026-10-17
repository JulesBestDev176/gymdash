'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Spinner from '@/components/ui/spinner';
import { adminApi, Gym, User } from '@/lib/api';
import { Users, Search } from 'lucide-react';

interface UserWithGym extends User { gymNom?: string; gymSlug?: string }

type RoleFilter = 'all' | 'ADMIN' | 'GERANT';

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithGym[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gymFilter, setGymFilter] = useState('');
  const [roleTab, setRoleTab] = useState<RoleFilter>('all');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get('/api/v1/gym/all').then(async (r) => {
      const gymList: Gym[] = Array.isArray(r.data) ? r.data : [];
      setGyms(gymList);
      const allUsers: UserWithGym[] = [];
      await Promise.all(
        gymList.map(async (g) => {
          try {
            const res = await adminApi.get(`/api/v1/users?gymId=${g.id}`);
            const list = Array.isArray(res.data) ? res.data : [];
            list.forEach((u: User) => allUsers.push({ ...u, gymNom: g.nom, gymSlug: g.slug }));
          } catch { /* skip */ }
        })
      );
      allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUsers(allUsers);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function toggleUser(u: UserWithGym) {
    setTogglingId(u.id);
    try {
      await adminApi.patch(`/api/v1/users/${u.id}`, { actif: !u.actif });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, actif: !x.actif } : x));
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = users.filter((u) => {
    if (roleTab !== 'all' && u.role !== roleTab) return false;
    if (gymFilter && u.gymNom !== gymFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        u.nom.toLowerCase().includes(s) ||
        u.prenom.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <Shell>
      <div className="space-y-6 fade-up">
        {/* Header */}
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-sub">
            <span className="num">{users.length}</span> compte(s) sur toutes les salles
          </p>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1" style={{ minWidth: '200px', maxWidth: '320px' }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg3)' }} />
            <input
              className="input-base"
              style={{ paddingLeft: '34px' }}
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Gym filter */}
          <select
            className="input-base"
            style={{ width: 'auto', minWidth: '160px' }}
            value={gymFilter}
            onChange={(e) => setGymFilter(e.target.value)}
          >
            <option value="">Toutes les salles</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.nom}>{g.nom}</option>
            ))}
          </select>
        </div>

        {/* Role tabs */}
        <div className="tab-bar">
          {([
            { key: 'all',   label: 'Tous' },
            { key: 'ADMIN', label: 'Propriétaires' },
            { key: 'GERANT',label: 'Réceptionnistes' },
          ] as { key: RoleFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              className={`tab-item${roleTab === key ? ' active' : ''}`}
              onClick={() => setRoleTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" style={{ color: 'var(--accent)' } as React.CSSProperties} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun utilisateur trouvé"
            subtitle="Modifiez les filtres ou créez un utilisateur depuis une salle"
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Salle</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.prenom} {u.nom}</td>
                    <td style={{ color: 'var(--fg2)' }}>{u.email}</td>
                    <td>
                      <Badge variant="neutral">{u.gymNom}</Badge>
                    </td>
                    <td>
                      <Badge variant={u.role === 'ADMIN' ? 'accent' : 'blue'}>{u.role}</Badge>
                    </td>
                    <td>
                      <Badge variant={u.actif ? 'success' : 'danger'}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className={u.actif ? 'btn-danger' : 'btn-success'}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        disabled={togglingId === u.id}
                        onClick={() => toggleUser(u)}
                      >
                        {togglingId === u.id
                          ? <Spinner size="sm" />
                          : u.actif ? 'Désactiver' : 'Activer'
                        }
                      </button>
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
