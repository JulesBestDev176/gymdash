/** Validate the existing session against the backend; never trust decoded JWT claims. */
export async function requireAdmin(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('authorization');
  const deny = (error: string, status: number) => Response.json({ error }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return deny('Connexion requise', 401);
  }
  try {
    const base = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.gympass.minifootapp.com').replace(/\/$/, '');
    const response = await fetch(`${base}/api/v1/auth/me`, {
      method: 'POST', headers: { Authorization: authorization },
      cache: 'no-store', signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (response.status === 401 || response.status === 403) return deny('Session expirée ou accès refusé', response.status);
    if (!response.ok) return deny('Vérification de session indisponible', 503);
    const body = await response.json();
    const user = (body.data ?? body).user;
    if (!user || user.role !== 'ADMIN' || user.actif === false) return deny('Accès administrateur requis', 403);
    return null;
  } catch {
    return deny('Vérification de session indisponible', 503);
  }
}
