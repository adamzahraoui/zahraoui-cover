import { Link } from 'react-router-dom'
import { useCompany } from '../../config/CompanyProvider'

export function Brand({ to = '/', light = false }: { to?: string; light?: boolean }) {
  const company = useCompany()
  return (
    <Link to={to} className={`inline-grid min-w-0 gap-0.5 rounded-sm leading-tight ${light ? 'text-white' : 'text-primary'}`}>
      {company.publicAgency?.logoUrl && <img src={company.publicAgency.logoUrl} alt="" className="h-8 w-auto" />}
      <span className="wrap-anywhere text-[16px] font-bold tracking-tight uppercase sm:text-lg">{company.name}</span>
      <span className="text-[10px] font-semibold tracking-[0.23em]">{company.lockup}</span>
    </Link>
  )
}
