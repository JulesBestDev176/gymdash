'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { adminApi, fmtFcfa, Gym } from '@/lib/api';
import { Plus, Building2, Users, TrendingUp } from 'lucide-react';

export default function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get('/gym/all')
      .then((r) => setGyms(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Salles de sport</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{gyms.length} salle(s) enregistrée(s)</p>
          </div>
          <Link
            href="/gyms/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'black' }}
          >
            <Plus size={16} />
            Nouvelle salle
          </Link>
        </div>

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Chargement...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gyms.map((gym) => (
              <Link
                key={gym.id}
                href={`/gyms/${gym.slug}`}
                className="rounded-xl p-5 border transition-all hover:border-[var(--accent)] hover:shadow-lg"
                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold">{gym.nom}</div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                      {gym.ville}, {gym.pays}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--muted-bg)' }}>
                    <Building2 size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                      <Users size={11} className="inline mr-1" />Adhérents
                    </div>
                    <div className="font-semibold text-sm">{gym.nbAdherents ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                      <TrendingUp size={11} className="inline mr-1" />Rev. mois
                    </div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
                      {(gym.revenuMois ?? 0).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Mensualité</div>
                    <div className="font-semibold text-sm">{gym.prixMensualite.toLocaleString('fr-FR')}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
