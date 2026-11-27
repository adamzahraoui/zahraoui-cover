import { Link } from 'react-router-dom'
import { company } from '../../config/company'

export function Brand({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className={`inline-grid shrink-0 gap-0.5 rounded-sm leading-tight ${light ? 'text-white' : 'text-primary'}`}>
      <span className="text-[16px] font-bold tracking-tight uppercase sm:text-lg">{company.name}</span>
      <span className="text-[10px] font-semibold tracking-[0.23em]">{company.lockup}</span>
    </Link>
  )
}
