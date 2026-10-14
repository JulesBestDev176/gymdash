import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 border flex flex-col gap-3',
        accent
          ? 'bg-[var(--accent)] border-[var(--accent-dark)] text-black'
          : 'bg-[var(--card)] border-[var(--card-border)]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', accent ? 'text-black/70' : 'text-[var(--muted)]')}>
          {label}
        </span>
        {icon && <span className={accent ? 'text-black/60' : 'text-[var(--muted)]'}>{icon}</span>}
      </div>
      <div className={cn('text-2xl font-bold', accent ? 'text-black' : 'text-[var(--foreground)]')}>
        {value}
      </div>
      {sub && (
        <div className={cn('text-xs', accent ? 'text-black/60' : 'text-[var(--muted)]')}>{sub}</div>
      )}
    </div>
  );
}
