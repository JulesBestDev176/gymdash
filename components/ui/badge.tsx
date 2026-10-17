type BadgeVariant = 'accent' | 'success' | 'danger' | 'warning' | 'blue' | 'purple' | 'neutral';
interface BadgeProps { variant?: BadgeVariant; children: React.ReactNode; className?: string; }
export default function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}
