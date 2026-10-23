/** Fixed release BFF. Platform authorization is verified by the backend BillingAdminGuard,
 * including its allowlist, before accepting upload bytes or sending a publication command. */
export async function proxyAppReleases(request: Request, segments: string[], config: { baseUrl: string; secret?: string }, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const path = segments.join('/');
  const method = request.method;
  const publish = /^admin\/[a-zA-Z0-9_-]{1,128}\/publish$/.test(path);
  if (!['admin', 'access', 'latest'].includes(path) && !publish) return fail('Ressource introuvable', 404);
  if (!(method === 'GET' && !publish || method === 'POST' && (path === 'admin' || publish))) return fail('Méthode non autorisée', 405);
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail('Connexion requise', 401);
  if (!config.secret) return fail('Gestion des versions non configurée', 503);
  const upstreamHeaders: Record<string, string> = { Authorization: authorization, 'x-gymdash-secret': config.secret };
  const base = `${config.baseUrl.replace(/\/$/, '')}/api/v1/app-releases`;
  const send = (url: string, init: RequestInit = {}) => fetcher(url, { ...init, headers: upstreamHeaders, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(method === 'POST' ? 300_000 : 25_000) });
  const failure = async (response: Response) => {
    if (response.status >= 500) return fail('Gestion des versions temporairement indisponible.', 503);
    const problem = await response.json().catch(() => ({}));
    const message = typeof problem.message === 'string' ? problem.message : 'Accès refusé ou demande invalide.';
    return fail(message.slice(0, 2048), response.status);
  };
  try {
    // Never substitute role ADMIN or decoded JWT claims for the platform allowlist.
    if (method === 'POST' || path === 'access' || path === 'latest') {
      const access = await send(`${base}/admin?limit=20`, { method: 'GET' });
      if (!access.ok) return failure(access);
      if (path === 'access') return Response.json({ allowed: true }, { headers });
    }
    let target = `${base}/${path === 'latest' ? 'android/latest' : path}`;
    let body: RequestInit['body'];
    if (path === 'admin' && method === 'GET') {
      const params = new URLSearchParams({ limit: '20' });
      const cursor = new URL(request.url).searchParams.get('cursor');
      if (cursor) { if (cursor.length > 512) return fail('Pagination invalide', 400); params.set('cursor', cursor); }
      target += `?${params}`;
    }
    if (method === 'POST' && path === 'admin') {
      const type = request.headers.get('content-type');
      if (!type?.startsWith('multipart/form-data; boundary=')) return fail('Un fichier APK est requis', 400);
      const max = 256 * 1024 * 1024 + 1024 * 1024; // bounded multipart overhead; backend limits APK to 256 MiB.
      if (Number(request.headers.get('content-length')) > max) return fail('APK trop volumineux (256 Mio maximum)', 413);
      const reader = request.body?.getReader();
      if (!reader) return fail('Un fichier APK est requis', 400);
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > max) { await reader.cancel(); return fail('APK trop volumineux (256 Mio maximum)', 413); } chunks.push(part.value); }
      body = new Blob(chunks as BlobPart[]);
      upstreamHeaders['Content-Type'] = type;
    }
    const response = await send(target, { method, body });
    if (!response.ok) return failure(response);
    const result = await response.json();
    return Response.json(result.data ?? result, { status: response.status, headers });
  } catch { return fail('Impossible de joindre le service. Actualisez les versions avant de réessayer une opération.', 503); }
}
