export const RESOURCE_IDS = {
  backend: 'm3tc4qsecffvu3cfqqcfsspc', dashboard: 'ijpluezkha433o1szxfxaqzp',
  database: 'i7bypsb5mxs0id639a60wjw9', relayio: '3ektrfq0ovokbn5lyzzes898',
};
export const REDEPLOYABLE_IDS = new Set([RESOURCE_IDS.backend, RESOURCE_IDS.dashboard]);

export async function coolifyRequest(path: string, options: RequestInit = {}) {
  const base = process.env.COOLIFY_BASE_URL?.replace(/\/$/, '');
  const token = process.env.COOLIFY_API_TOKEN;
  if (!base || !token) throw new Error('Connexion Coolify non configurée');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`${base}/api/v1${path}`, {
    ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(8000), redirect: 'error',
  });
}

export async function coolifyJson(path: string) {
  const response = await coolifyRequest(path);
  if (!response.ok) throw new Error(`Coolify indisponible (${response.status})`);
  return response.json();
}
