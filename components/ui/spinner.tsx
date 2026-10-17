interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; className?: string; style?: React.CSSProperties; label?: string; }
export default function Spinner({ size = 'md', className = '', style, label = 'Chargement en cours' }: SpinnerProps) {
  return <span role="status" aria-label={label} className={`spinner spinner-${size} ${className}`} style={style} />;
}
