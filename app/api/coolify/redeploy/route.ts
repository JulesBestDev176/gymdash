import { requireAdmin } from '@/lib/server/admin-auth';
import { coolifyRequest, REDEPLOYABLE_IDS } from '@/lib/server/coolify';

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  let uuid: unknown;
  try { ({ uuid } = await request.json()); }
  catch { return Response.json({ error: 'Requête JSON invalide' }, { status: 400 }); }
  if (typeof uuid !== 'string' || !REDEPLOYABLE_IDS.has(uuid)) {
    return Response.json({ error: 'Ce service ne peut pas être redéployé depuis GymDash' }, { status: 403 });
  }
  try {
    const response = await coolifyRequest('/deploy', { method: 'POST', body: JSON.stringify({ uuid, force: true }) });
    if (!response.ok) return Response.json({ error: `Coolify a refusé le déploiement (${response.status})` }, { status: 502 });
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Service de déploiement indisponible' }, { status: 503 }); }
}
