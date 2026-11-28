import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionLink } from '../ui/Button'
import { getInsurance } from '../../data/insurance'
import type { ProductCard } from '../../types/api'

export function InsuranceCard({ product, illustrated = false }: { product: ProductCard; illustrated?: boolean }) {
  const { slug, title: label, summary } = product
  const Icon = getInsurance(slug).icon
  const Heading = illustrated ? 'h2' : 'h3'
  const detailsLabel = illustrated ? 'Découvrir' : 'En savoir plus'
  return (
    <article className="panel flex flex-col overflow-hidden">
      {illustrated && (
        <div className="hidden aspect-[2.65] place-items-center border-b border-line bg-surface-tint md:grid" aria-hidden="true">
          <Icon size={46} strokeWidth={1.15} className="text-soft-blue" />
        </div>
      )}
      <div className="flex flex-1 items-start gap-3 p-4 lg:p-6">
        <span className={`grid size-10 shrink-0 place-items-center rounded bg-primary-tint text-primary ${illustrated ? 'md:hidden' : ''}`}><Icon size={20} aria-hidden /></span>
        <div className="min-w-0">
          <Heading className="text-base font-semibold text-ink lg:text-lg">{label}</Heading>
          <p className="mt-1.5 text-sm leading-6 text-muted">{summary}</p>
        </div>
      </div>
      <div className={`gap-2 border-t border-line px-4 py-3 lg:px-6 ${illustrated ? 'grid grid-cols-2 md:bg-background' : 'flex bg-background'}`}>
        <Link to={`/assurances/${slug}`} aria-label={`${detailsLabel} : ${label}`} className={illustrated ? 'action action-secondary' : 'text-link inline-flex items-center gap-1 text-sm'}>
          {detailsLabel}{!illustrated && <ChevronRight size={15} aria-hidden />}
        </Link>
        {illustrated && <ActionLink to={`/devis?type=${slug}`}>Devis</ActionLink>}
      </div>
    </article>
  )
}
