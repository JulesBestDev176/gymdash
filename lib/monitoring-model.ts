export type ServiceState = 'up' | 'down' | 'degraded';
export interface MonitorAlert { id: string; severity: 'warning' | 'critical' | 'info'; title: string; detail: string }
export interface ServerMetrics {
  cpuPercent: number | null; memoryUsedBytes: number | null; memoryTotalBytes: number | null;
  memoryPercent: number | null; diskUsedBytes: number | null; diskTotalBytes: number | null;
  diskPercent: number | null; uptimeSeconds: number | null;
}
export interface ApiRoute {
  method: string; route: string; count: number; errors4xx: number; errors5xx: number;
  avgMs: number; p95Ms: number; p99Ms: number; maxMs: number; errorRate: number;
}
export interface CollectorSnapshot {
  timestamp: string; server: ServerMetrics | null;
  history: { timestamp: string; cpuPercent: number | null; memoryPercent: number | null; diskPercent: number | null }[];
  storage: { name: string; mountpoint: string; sizeBytes: number | null; usedBytes: number | null; refCount: number | null; available: boolean }[];
  containers: { id: string; name: string; status: string; image: string; privileged: boolean; user: string; publishedPorts: unknown[] }[];
  api: { routes: ApiRoute[]; history: { timestamp: string; count: number; errors5xx: number; avgMs: number }[]; totalRequests: number; totalErrors: number; errorRate: number };
  alerts: MonitorAlert[];
  collection: { intervalSeconds: number; retentionDays: number; startedAt: string; errors: string[]; lastSampleAt: string | null };
}
export interface MonitoringService {
  uuid: string; name: string; fqdn: string | null; status: string; image: string | null;
  latencyMs: number | null; httpStatus: number | null; group: string; state: ServiceState; redeployable: boolean;
}
export interface SecurityCheck { id: string; title: string; status: 'ok' | 'warning' | 'unknown'; detail: string }
export interface BackupInfo { uuid: string; enabled: boolean; frequency: string; lastStatus: string | null; lastAt: string | null }
export interface MonitoringData {
  services: MonitoringService[]; serverStatus: { reachable: boolean; ip: string | null }; timestamp: string;
  metrics: CollectorSnapshot | null; alerts: MonitorAlert[]; security: SecurityCheck[];
  backups: BackupInfo[] | null; partialErrors: string[]; hours: number;
}

export function containerMetadataAvailable(snapshot: { containers: unknown[]; collection: { errors: string[] } } | null): boolean {
  return !!snapshot?.containers.length && !snapshot.collection.errors.some(error => /docker|conteneur/i.test(error));
}

export function serviceState(raw: string, httpHealthy: boolean | null): ServiceState {
  const value = raw.toLowerCase();
  if (!value.startsWith('running') && value !== 'up') return 'down';
  if (httpHealthy === false) return 'down';
  if (httpHealthy === true || value === 'running:healthy' || value === 'running' || value === 'up') return 'up';
  return 'degraded';
}

export function thresholdAlerts(
  server: Pick<ServerMetrics, 'cpuPercent' | 'memoryPercent' | 'diskPercent'> | null,
  routes: Pick<ApiRoute, 'method' | 'route' | 'count' | 'p95Ms' | 'errorRate'>[],
): MonitorAlert[] {
  const alerts: MonitorAlert[] = [];
  for (const [id, label, value, threshold] of [
    ['cpu', 'CPU élevée', server?.cpuPercent, 85],
    ['memory', 'Mémoire élevée', server?.memoryPercent, 85],
    ['disk', 'Disque presque plein', server?.diskPercent, 80],
  ] as const) {
    if (value != null && value >= threshold) alerts.push({ id, title: label,
      severity: value >= 95 ? 'critical' : 'warning', detail: `${Math.round(value)} % utilisés · seuil ${threshold} %` });
  }
  for (const route of routes) {
    if (route.count >= 5 && route.p95Ms >= 1000) alerts.push({ id: `latency:${route.method}:${route.route}`, severity: 'warning',
      title: 'API lente', detail: `${route.method} ${route.route} · p95 ${Math.round(route.p95Ms)} ms` });
    if (route.count >= 20 && route.errorRate >= 0.01) alerts.push({ id: `errors:${route.method}:${route.route}`, severity: 'critical',
      title: 'Erreurs serveur', detail: `${route.method} ${route.route} · ${(route.errorRate * 100).toFixed(1)} % de réponses 5xx` });
  }
  return alerts;
}

export function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return 'Indisponible';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const index = value > 0 ? Math.min(4, Math.floor(Math.log(value) / Math.log(1024))) : 0;
  return `${(value / 1024 ** index).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[index]}`;
}
