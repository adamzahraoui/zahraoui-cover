import { ChevronDown, Headset, Menu, Phone } from 'lucide-react'
import { useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCompany } from '../../config/CompanyProvider'
import { publicNavigation } from '../../config/navigation'
import { ActionLink } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { usePublicCatalog } from './PublicCatalog'
import { Brand } from './Brand'

export function Header({ compact = false }: { compact?: boolean }) {
  const company = useCompany()
  const { data: products = [] } = usePublicCatalog()
  const mobileNav = useRef<HTMLDialogElement>(null)
  const categories = useRef<HTMLDetailsElement>(null)
  return (
    <header className="border-b border-line bg-white">
      <div className="bg-primary text-white">
        <div className="site-container flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2 text-xs font-semibold lg:justify-start lg:gap-x-8 lg:py-2.5">
          <a href={company.office.href} aria-label={`${company.office.label} : ${company.office.number}`} className="inline-flex items-center gap-1.5 hover:underline">
            <Phone size={13} className="hidden lg:block" aria-hidden /><span><span className="hidden lg:inline">{company.office.label} : </span>{company.office.number}</span>
          </a>
          <a href={company.assistance.href} aria-label={`${company.assistance.label} : ${company.assistance.number}`} className="inline-flex items-center gap-1.5 hover:underline">
            <Headset size={14} className="hidden lg:block" aria-hidden /><span><span className="lg:hidden">Assist. </span><span className="hidden lg:inline">{company.assistance.label} : </span>{company.assistance.number}</span>
          </a>
          <span className="ml-auto hidden text-sm font-normal text-blue-100 lg:inline">{compact ? 'Sans création de compte' : `${company.descriptor} — Maroc`}</span>
        </div>
      </div>
      <div className="site-container flex min-h-16 items-center justify-between gap-3 lg:min-h-20">
        <Brand />
        {compact ? <Link to="/assurances" className="text-link text-right text-sm">Retour au catalogue</Link> : (
          <>
            <nav aria-label="Navigation principale" className="hidden items-center gap-3 text-sm font-semibold text-muted lg:flex xl:gap-6">
              {publicNavigation.map(({ to, label }) => (
                to === '/assurances' ? (
                  <div key={to} className="flex items-center gap-0.5">
                    <NavLink to={to} className="rounded py-3 hover:text-primary aria-[current=page]:text-primary">{label}</NavLink>
                    {products.length > 0 && <details ref={categories} className="relative" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}>
                      <summary aria-label="Afficher les catégories d’assurance" className="list-none rounded p-2 hover:bg-background"><ChevronDown size={15} /></summary>
                      <ul className="panel absolute top-full left-0 z-10 w-64 p-2">
                        {products.map(({ slug, title }) => (
                          <li key={slug}><Link to={`/assurances/${slug}`} className="block rounded p-2 hover:bg-background" onClick={() => { if (categories.current) categories.current.open = false }}>{title}</Link></li>
                        ))}
                      </ul>
                    </details>}
                  </div>
                ) : <NavLink to={to} key={to} end={to === '/'} className="rounded py-3 hover:text-primary aria-[current=page]:text-primary">{label}</NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <ActionLink to="/devis" className="hidden sm:inline-flex">Demander un devis</ActionLink>
              <a href={company.office.href} aria-label={'Appeler ' + company.name} className="grid size-11 place-items-center rounded bg-primary-tint text-primary sm:hidden"><Phone size={19} aria-hidden /></a>
              <button type="button" aria-label="Ouvrir le menu" onClick={() => mobileNav.current?.showModal()} className="rounded border border-line p-2.5 text-primary lg:hidden"><Menu size={22} /></button>
            </div>
          </>
        )}
      </div>
      <Dialog title="Navigation" dialogRef={mobileNav}>
        <nav aria-label="Navigation mobile" className="grid">
          {[...publicNavigation, { to: '/assistance', label: 'Assistance' }, { to: '/faq', label: 'FAQ' }, { to: '/devis', label: 'Demander un devis' }].map(({ to, label }) => (
            <NavLink end={to === '/'} to={to} key={to} onClick={() => mobileNav.current?.close()} className="rounded border-b border-line p-3 font-medium text-primary aria-[current=page]:bg-primary-tint">{label}</NavLink>
          ))}
        </nav>
      </Dialog>
    </header>
  )
}
