interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}
export default function EmptyState({ icon: Icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--card2)', color: 'var(--fg3)' }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{title}</p>
        {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--fg3)' }}>{subtitle}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
