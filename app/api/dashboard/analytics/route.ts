import { requireAdmin } from '@/lib/server/admin-auth';
import { fetchDashboardAnalytics } from '@/lib/server/dashboard-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return fetchDashboardAnalytics(request, new URL(request.url).searchParams.get('period') ?? '6m', {
    baseUrl: process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.gympass.minifootapp.com',
    secret: process.env.GYMDASH_SECRET,
  });
}
