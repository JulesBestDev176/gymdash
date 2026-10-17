export type DashboardPeriod = '30d' | '90d' | '6m';
export interface DashboardAnalytics {
  period: DashboardPeriod;
  range: { from: string; to: string; granularity: 'day' | 'week' | 'month'; label: string };
  totals: { revenue: number; payments: number; newMembers: number; entries: number; activeGyms: number; members: number };
  series: { key: string; label: string; revenue: number; newMembers: number; entries: number }[];
  paymentModes: { mode: string; label: string; amount: number; count: number }[];
  subscriptions: { status: string; label: string; count: number }[];
  gyms: { id: string; name: string; revenue: number; payments: number; newMembers: number; entries: number; members: number }[];
  generatedAt: string;
}

export type GymMetric = 'revenue' | 'members' | 'entries';

/** Keep the full network total when presenting a limited ranking. Never sort the response in place. */
export function rankGyms(gyms: DashboardAnalytics['gyms'], metric: GymMetric, limit = 10) {
  const ranked = [...gyms].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'fr'));
  return {
    gyms: ranked.slice(0, Math.max(0, Math.floor(limit))),
    total: gyms.every(gym => Number.isFinite(gym[metric])) ? gyms.reduce((sum, gym) => sum + gym[metric], 0) : null,
    count: gyms.length,
    omittedCount: Math.max(0, gyms.length - Math.max(0, Math.floor(limit))),
  };
}
