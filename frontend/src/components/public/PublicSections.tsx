import { ChevronDown, Headset, Phone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCompany } from '../../config/CompanyProvider'
import { ActionLink } from '../ui/Button'
import { Breadcrumb } from '../ui/Breadcrumb'

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <section className="border-b border-line bg-white">
      <div className="site-container grid gap-3 py-8 lg:gap-4 lg:py-12">
        <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: title }]} />
        <h1 className="display-title">{title}</h1>
        {description && <p className="max-w-3xl text-base leading-7 text-muted lg:text-lg">{description}</p>}
      </div>
    </section>
  )
}

export function MediaPlaceholder({ icon: Icon, className = '' }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={`grid min-h-36 place-items-center overflow-hidden rounded-md border border-line bg-surface-tint ${className}`} aria-hidden="true">
      <span className="grid size-23 place-items-center rounded-full border border-white bg-white/65 sm:size-28">
        <Icon className="size-11 text-soft-blue sm:size-14" strokeWidth={1.2} />
      </span>
    </div>
  )
}

export function ActionBand({ title, children, assistance = false }: { title: string; children: ReactNode; assistance?: boolean }) {
  const company = useCompany()
  return (
    <section className="bg-primary text-white">
      <div className="site-container flex flex-col gap-5 py-9 lg:flex-row lg:items-center lg:justify-between lg:py-12">
        <div className="min-w-0">
          <h2 className="text-2xl/8 font-bold">{title}</h2>
          <p className="mt-2 max-w-2xl leading-7 text-blue-100">{children}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActionLink variant="light" to={assistance ? '/assistance' : '/devis'}>{assistance ? 'Service d’assistance' : 'Demander un devis'}</ActionLink>
          <a href={assistance ? company.assistance.href : company.office.href} className="action border border-white/70 text-white hover:bg-white/10">
            {assistance ? <Headset size={16} aria-hidden /> : <Phone size={16} aria-hidden />}
            {assistance ? company.assistance.number : company.office.number}
          </a>
        </div>
      </div>
    </section>
  )
}

export function Accordion({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="panel group">
      <summary className="flex list-none items-center justify-between gap-3 rounded-md p-4 font-semibold text-ink hover:bg-background [&::-webkit-details-marker]:hidden">
        {question}<ChevronDown size={18} className="shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-4 leading-7 text-muted">{children}</div>
    </details>
  )
}

export function ContentCard({ title, children, icon: Icon }: { title: string; children: ReactNode; icon?: LucideIcon }) {
  return (
    <article className="panel p-5">
      {Icon && <span className="mb-3 grid size-10 place-items-center rounded bg-primary-tint text-primary"><Icon size={19} aria-hidden /></span>}
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </article>
  )
}
