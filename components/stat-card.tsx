interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}

export default function StatCard({ label, value, sub, accent, icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className={accent ? 'card-accent p-5 flex flex-col gap-3' : 'card p-5 flex flex-col gap-3'}>
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-7 w-24 mt-1" />
        {sub && <div className="skeleton h-2 w-16" />}
      </div>
    );
  }

  return (
    <div className={accent ? 'card-accent p-5 flex flex-col gap-2' : 'card p-5 flex flex-col gap-2'}>
      <div className="flex items-start justify-between gap-2">
        <span className="section-label">{label}</span>
        {icon && (
          <span className={accent ? 'icon-chip icon-chip-accent' : 'icon-chip'}>
            {icon}
          </span>
        )}
      </div>
      <div className={accent ? 'stat-value stat-value-accent' : 'stat-value'}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--fg3)' }}>{sub}</div>}
    </div>
  );
}
