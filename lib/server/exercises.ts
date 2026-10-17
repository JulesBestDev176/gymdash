function allowedMethod(path: string) {
  if (path === 'admin/all' || path === 'admin/catalog') return 'GET';
  if (path === 'admin' || path === 'admin/import') return 'POST';
  if (/^admin\/[a-zA-Z0-9_-]{1,128}(?:\/(?:source|toggle))?$/.test(path) && !['admin/all', 'admin/catalog', 'admin/import'].includes(path)) return 'PATCH';
}

/** Private exercise gateway. Mutations are deliberately sent exactly once. */
export async function proxyExercises(request: Request, segments: string[], config: { baseUrl: string; secret?: string }, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const path = segments.join('/');
  const method = allowedMethod(path);
  if (!method) return fail('Ressource introuvable', 404);
  if (request.method !== method) return fail('Méthode non autorisée', 405);
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail('Connexion requise', 401);
  if (!config.secret) return fail('Service exercices non configuré', 503);
  let body: string | undefined;
  if (method !== 'GET') {
    if (Number(request.headers.get('content-length')) > 32768) return fail('Données trop volumineuses', 413);
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 32768) { await reader.cancel(); return fail('Données trop volumineuses', 413); }
          chunks.push(part.value);
        }
      } catch { return fail('Données illisibles', 400); }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    body = new TextDecoder().decode(bytes);
    try { const value = JSON.parse(body); if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Objet JSON attendu', 400); }
    catch { return fail('Données illisibles', 400); }
  }
  const target = new URL(`${config.baseUrl.replace(/\/$/, '')}/api/v1/gymbro/exercises/${path}`);
  if (path === 'admin/catalog') {
    const search = new URL(request.url).searchParams;
    for (const key of ['q', 'group', 'equipment', 'page', 'hasAnimation']) if (search.has(key)) target.searchParams.set(key, search.get(key)!.slice(0, 256));
  }
  try {
    const response = await fetcher(target.toString(), {
      method, body, headers: { Authorization: authorization, 'x-gymdash-secret': config.secret, 'Content-Type': 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'Données invalides. Vérifiez les champs et la validation du mouvement.',
        401: 'Session expirée. Reconnectez-vous.', 403: 'Accès administrateur requis.',
        404: 'Exercice introuvable. Actualisez la bibliothèque.',
        409: 'Conflit : source déjà liée ou exercice modifié entre-temps. Actualisez la bibliothèque et vérifiez de nouveau.',
        422: 'Animation disponible et validation du mouvement requises avant publication.',
        429: 'Trop de demandes. Réessayez dans un instant.',
      };
      return fail(messages[response.status] || 'Le service exercices est temporairement indisponible.', response.status >= 500 ? 503 : response.status);
    }
    const result = await response.json();
    return Response.json(result.data ?? result, { status: response.status, headers });
  } catch { return fail('Impossible de joindre les exercices. Actualisez avant de renouveler une modification.', 503); }
}
