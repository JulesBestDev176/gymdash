export async function fetchDashboardAnalytics(
  request: Request,
  period: string,
  config: { baseUrl: string; secret?: string },
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (!['30d', '90d', '6m'].includes(period)) return fail('Période invalide', 400);
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail('Connexion requise', 401);
  if (!config.secret) return fail('Connexion aux statistiques non configurée', 503);
  try {
    const url = `${config.baseUrl.replace(/\/$/, '')}/api/v1/dashboard/global/analytics?period=${period}`;
    const response = await fetcher(url, {
      headers: { Authorization: authorization, 'x-gymdash-secret': config.secret },
      cache: 'no-store', signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    if ([401, 403].includes(response.status)) return fail('Session expirée ou accès refusé', response.status);
    if (!response.ok) return fail('Les statistiques détaillées sont temporairement indisponibles', 503);
    const body = await response.json();
    const data = body.data ?? body;
    if (data?.period !== period || !data.range || typeof data.range.label !== 'string'
      || !data.totals || !['revenue', 'payments', 'newMembers', 'entries', 'activeGyms', 'members'].every(key => Number.isFinite(data.totals[key]))
      || !['series', 'paymentModes', 'subscriptions', 'gyms'].every(key => Array.isArray(data[key]))
      || !Number.isFinite(Date.parse(data.generatedAt))) return fail('Les statistiques reçues sont incomplètes', 503);
    return Response.json(data, { headers });
  } catch { return fail('Impossible de joindre les statistiques du dashboard', 503); }
}
