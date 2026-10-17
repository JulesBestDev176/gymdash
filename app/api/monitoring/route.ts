import { requireAdmin } from '@/lib/server/admin-auth';
import { coolifyJson, RESOURCE_IDS } from '@/lib/server/coolify';
import { containerMetadataAvailable, serviceState, thresholdAlerts } from '@/lib/monitoring-model';
import type { BackupInfo, CollectorSnapshot, MonitoringData, MonitoringService, SecurityCheck } from '@/lib/monitoring-model';

export const dynamic = 'force-dynamic';

async function probe(url: string | null, path: string) {
  if (!url) return { latencyMs: null, httpStatus: null, healthy: null };
  const start = performance.now();
  try {
    const response = await fetch(new URL(path, url), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    return { latencyMs: Math.round(performance.now() - start), httpStatus: response.status, healthy: response.ok };
  } catch { return { latencyMs: null, httpStatus: null, healthy: false }; }
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const selected = Number(new URL(request.url).searchParams.get('hours') ?? 24);
  const hours = [1, 24, 168].includes(selected) ? selected : 24;
  const partialErrors: string[] = [];
  const get = async (path: string, label: string) => {
    try { return await coolifyJson(path); }
    catch { partialErrors.push(`${label} indisponible`); return null; }
  };
  const [backend, dashboard, database, relayio, server, backupData, metrics] = await Promise.all([
    get(`/applications/${RESOURCE_IDS.backend}`, 'API GymPass'),
    get(`/applications/${RESOURCE_IDS.dashboard}`, 'Dashboard'),
    get(`/databases/${RESOURCE_IDS.database}`, 'PostgreSQL'),
    get(`/applications/${RESOURCE_IDS.relayio}`, 'Relayio'),
    get(`/servers/${process.env.COOLIFY_SERVER_UUID || '0zhymvsiqxum66mzs3v79yoj'}`, 'Serveur Coolify'),
    get(`/databases/${RESOURCE_IDS.database}/backups`, 'Sauvegardes'),
    (async (): Promise<CollectorSnapshot | null> => {
      if (!process.env.MONITORING_URL || !process.env.MONITORING_TOKEN) {
        partialErrors.push('Collecteur non configuré'); return null;
      }
      try {
        const url = `${process.env.MONITORING_URL.replace(/\/$/, '')}/snapshot?hours=${hours}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.MONITORING_TOKEN}` }, cache: 'no-store', signal: AbortSignal.timeout(8000), redirect: 'error' });
        if (!response.ok) throw new Error('collector');
        return await response.json();
      } catch { partialErrors.push('Collecteur de métriques indisponible'); return null; }
    })(),
  ]);
  const targets = [
    { data: backend, uuid: RESOURCE_IDS.backend, name: 'gympass-backend', url: 'https://api.gympass.minifootapp.com', path: '/api/v1/health', redeployable: true },
    { data: dashboard, uuid: RESOURCE_IDS.dashboard, name: 'gymdash', url: 'https://dash.gympass.minifootapp.com', path: '/login', redeployable: true },
    { data: database, uuid: RESOURCE_IDS.database, name: 'gympass-postgres', url: null, path: '/', redeployable: false },
    { data: relayio, uuid: RESOURCE_IDS.relayio, name: 'relayio', url: 'https://relayio.minifootapp.com', path: '/v1/pricing', redeployable: false },
  ];
  const services: MonitoringService[] = await Promise.all(targets.map(async (target) => {
    const result = await probe(target.url, target.path);
    const status = target.data?.status ?? 'unknown';
    return { uuid: target.uuid, name: target.name, fqdn: target.url, status,
      image: target.data?.docker_registry_image_name ?? target.data?.image ?? null,
      latencyMs: result.latencyMs, httpStatus: result.httpStatus, state: serviceState(status, result.healthy),
      group: target.name === 'relayio' ? 'Messagerie' : 'GymPass', redeployable: target.redeployable };
  }));
  const rawBackups = Array.isArray(backupData) ? backupData : backupData?.data;
  const backups: BackupInfo[] | null = Array.isArray(rawBackups) ? await Promise.all(rawBackups.map(async (backup: Record<string, unknown>) => {
    const uuid = String(backup.uuid ?? '');
    let lastStatus: string | null = null, lastAt: string | null = null;
    if (uuid && /^[a-zA-Z0-9_-]+$/.test(uuid)) {
      const result = await get(`/databases/${RESOURCE_IDS.database}/backups/${uuid}/executions`, 'Historique sauvegardes');
      const executions = Array.isArray(result) ? result : result?.data;
      if (Array.isArray(executions) && executions.length) {
        const last = [...executions].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        lastStatus = last.status ?? null; lastAt = last.created_at ?? null;
      }
    }
    return { uuid, enabled: backup.enabled === true || backup.enabled === 1, frequency: String(backup.frequency ?? 'Non précisée'), lastStatus, lastAt };
  })) : null;
  const containerMetadataKnown = containerMetadataAvailable(metrics);
  const security: SecurityCheck[] = [
    { id: 'auth', title: 'Accès administrateur', status: 'ok', detail: 'Session vérifiée par le backend pour chaque lecture et action.' },
    { id: 'database', title: 'Exposition PostgreSQL', status: database ? (database.is_public ? 'warning' : 'ok') : 'unknown', detail: database ? (database.is_public ? 'La base possède un port public.' : 'Base accessible uniquement sur le réseau privé.') : 'État indisponible.' },
    { id: 'backups', title: 'Sauvegardes PostgreSQL', status: backups ? (backups.some(b => b.enabled) ? 'ok' : 'warning') : 'unknown', detail: backups ? (backups.some(b => b.enabled) ? 'Planification présente ; contrôler les exécutions ci-dessous.' : 'Aucune sauvegarde automatique active.') : 'Configuration indisponible.' },
    { id: 'privileged', title: 'Conteneurs privilégiés', status: containerMetadataKnown ? (metrics!.containers.some(c => c.privileged) ? 'warning' : 'ok') : 'unknown', detail: containerMetadataKnown ? `${metrics!.containers.filter(c => c.privileged).length} conteneur(s) privilégié(s) parmi les services suivis.` : 'Métadonnées des conteneurs indisponibles.' },
    { id: 'root', title: 'Utilisateur des conteneurs', status: containerMetadataKnown ? (metrics!.containers.some(c => !c.user || c.user === '0' || c.user === 'root') ? 'warning' : 'ok') : 'unknown', detail: containerMetadataKnown ? `${metrics!.containers.filter(c => !c.user || c.user === '0' || c.user === 'root').length} conteneur(s) configuré(s) avec l’utilisateur root par défaut.` : 'Métadonnées des conteneurs indisponibles.' },
    { id: 'https', title: 'Transport HTTPS des applications', status: services.filter(s => s.fqdn).every(s => s.httpStatus != null && s.httpStatus < 400) ? 'ok' : 'unknown', detail: 'Sondes HTTPS avec validation des certificats ; un service non joignable ne permet pas de confirmer son transport.' },
    { id: 'control-transport', title: 'Transport de l’API Coolify', status: process.env.COOLIFY_BASE_URL?.startsWith('https://') ? 'ok' : 'warning', detail: process.env.COOLIFY_BASE_URL?.startsWith('https://') ? 'Connexion de contrôle chiffrée.' : 'L’API de contrôle utilise HTTP. Prévoir HTTPS ou un réseau privé pour protéger son jeton.' },
  ];
  const generated = thresholdAlerts(metrics?.server ?? null, metrics?.api.routes ?? []);
  const alerts = [...generated, ...(metrics?.alerts ?? [])];
  for (const service of services.filter(s => s.state !== 'up')) alerts.push({ id: `service:${service.uuid}`, severity: service.state === 'down' ? 'critical' : 'warning', title: service.state === 'down' ? 'Service indisponible' : 'Santé du service incertaine', detail: service.name });
  for (const check of security.filter(c => c.status === 'warning')) alerts.push({ id: `security:${check.id}`, severity: 'warning', title: check.title, detail: check.detail });
  const result: MonitoringData = {
    services, serverStatus: { reachable: !!server?.settings?.is_reachable, ip: server?.ip ?? null },
    timestamp: new Date().toISOString(), metrics, alerts: [...new Map(alerts.map(a => [a.id, a])).values()], security, backups, partialErrors, hours,
  };
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
