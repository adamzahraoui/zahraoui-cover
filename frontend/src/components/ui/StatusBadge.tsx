type Tone = 'info' | 'success' | 'neutral' | 'warning' | 'danger'

const styles: Record<Tone, string> = {
  info: 'bg-primary-tint text-primary',
  success: 'bg-green-100 text-green-800',
  neutral: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{label}</span>
}
