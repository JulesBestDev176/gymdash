/** Development hosts cannot resolve the collector's private Docker DNS name. */
export async function proxyDevelopmentMonitoring(
  request: Request,
  hours: number,
  config: { environment: string; url?: string },
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  if (config.environment !== 'development' || !config.url) return null;
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail('Connexion requise', 401);
  let target: URL;
  try {
    target = new URL(config.url);
    if (target.protocol !== 'https:' || target.username || target.password || target.hash || target.search
      || target.pathname !== '/api/monitoring' || target.origin === new URL(request.url).origin) {
      throw new Error('Invalid monitoring proxy');
    }
  } catch { return fail('Connexion au monitoring de production mal configurée', 503); }
  target.searchParams.set('hours', String([1, 24, 168].includes(hours) ? hours : 24));
  try {
    const response = await fetcher(target.toString(), {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (response.status === 401 || response.status === 403) return fail('Session expirée ou accès refusé', response.status);
    if (!response.ok) return fail('Monitoring de production temporairement indisponible', 503);
    return Response.json(await response.json(), { headers });
  } catch { return fail('Impossible de joindre le monitoring de production', 503); }
}
