import { proxyAppReleases } from '@/lib/server/app-releases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyAppReleases(request, (await context.params).path, {
    baseUrl: process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.gympass.minifootapp.com',
    secret: process.env.GYMDASH_SECRET,
  });
}
export { handler as GET, handler as POST };
