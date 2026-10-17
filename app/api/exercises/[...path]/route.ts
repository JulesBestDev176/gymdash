import { requireAdmin } from '@/lib/server/admin-auth';
import { proxyExercises } from '@/lib/server/exercises';

export const dynamic = 'force-dynamic';

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return proxyExercises(request, (await context.params).path, {
    baseUrl: process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.gympass.minifootapp.com',
    secret: process.env.GYMDASH_SECRET,
  });
}

export { handler as GET, handler as POST, handler as PATCH };
