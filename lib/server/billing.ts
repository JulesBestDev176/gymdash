function allowedMethod(path: string): string | undefined {
  if (path === 'overview') return 'GET';
  if (path === 'settings') return 'PATCH';
  if (path === 'invoices') return 'GET,POST';
  if (/^gyms\/[a-zA-Z0-9_-]{1,128}$/.test(path)) return 'PUT';
  if (/^invoices\/[a-zA-Z0-9_-]{1,128}\/pdf$/.test(path)) return 'GET';
  if (/^invoices\/[a-zA-Z0-9_-]{1,128}\/(?:payments|cancel)$/.test(path)) return 'POST';
}

/** Financial writes are never retried here; their command ID belongs to the caller. */
export async function proxyBilling(request: Request, segments: string[], config: { baseUrl: string; secret?: string }, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const path = segments.join('/');
  const methods = allowedMethod(path);
  if (!methods) return fail('Ressource de facturation introuvable', 404);
  if (!methods.split(',').includes(request.method)) return fail('Méthode non autorisée', 405);
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail('Connexion requise', 401);
  if (!config.secret) return fail('Connexion à la facturation non configurée', 503);
  let body: string | undefined;
  if (request.method !== 'GET') {
    body = await request.text();
    if (body.length > 16_384) return fail('Données de facturation trop volumineuses', 413);
    try { JSON.parse(body); } catch { return fail('Données de facturation illisibles', 400); }
  }
  const target = new URL(`${config.baseUrl.replace(/\/$/, '')}/api/v1/platform-billing/${path}`);
  if (path === 'invoices' && request.method === 'GET') {
    const search = new URL(request.url).searchParams;
    for (const key of ['page', 'gymId', 'status']) if (search.has(key)) target.searchParams.set(key, search.get(key)!);
  }
  try {
    const response = await fetcher(target.toString(), {
      method: request.method, body,
      headers: { Authorization: authorization, 'x-gymdash-secret': config.secret, 'Content-Type': 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      if (response.status >= 500) return fail('La facturation est temporairement indisponible.', 503);
      const problem = await response.json().catch(() => ({}));
      const message = typeof problem.message === 'string' ? problem.message : Array.isArray(problem.message) ? problem.message.filter((item: unknown) => typeof item === 'string').join(' · ') : 'Accès refusé ou demande de facturation invalide.';
      return fail(message.slice(0, 2048), response.status);
    }
    if (path.endsWith('/pdf')) {
      if (!response.headers.get('content-type')?.startsWith('application/pdf')) return fail('La facture PDF est indisponible.', 503);
      const filename = response.headers.get('content-disposition')?.match(/GP-\d{4}-\d+\.pdf/)?.[0] || 'facture.pdf';
      return new Response(await response.arrayBuffer(), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` } });
    }
    const result = await response.json();
    return Response.json(result.data ?? result, { status: response.status, headers });
  } catch { return fail('Impossible de joindre la facturation. Vérifiez son état avant de renouveler votre demande.', 503); }
}
