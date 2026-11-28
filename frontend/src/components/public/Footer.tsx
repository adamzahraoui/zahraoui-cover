import { Link } from 'react-router-dom'
import { useCompany } from '../../config/CompanyProvider'
import { policyNavigation } from '../../config/navigation'
import { usePublicCatalog } from './PublicCatalog'
import { Brand } from './Brand'

const links = [
  { to: '/assurances', label: 'Nos assurances' },
  { to: '/particuliers', label: 'Particuliers' },
  { to: '/professionnels', label: 'Professionnels' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/faq', label: 'FAQ' },
]

export function Footer() {
  const company = useCompany()
  const { data: products = [] } = usePublicCatalog()
  return (
    <footer className="bg-primary-dark text-white">
      <div className="site-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:py-12">
        <div><Brand light /><p className="mt-4 text-sm leading-6 text-blue-100">{company.descriptor} au Maroc.</p></div>
        <div>
          <h2 className="mb-3 font-semibold">Navigation</h2>
          <ul className="space-y-2 text-sm text-blue-100">{links.map(link => <li key={link.to}><Link className="hover:underline" to={link.to}>{link.label}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Nos assurances</h2>
          <ul className="space-y-2 text-sm text-blue-100">{products.map(item => <li key={item.slug}><Link className="hover:underline" to={`/assurances/${item.slug}`}>{item.title}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Contact</h2>
          <ul className="space-y-2 text-sm text-blue-100">
            {[company.office, company.assistance].map(item => <li key={item.href}><a className="hover:underline" href={item.href}>{item.label} : {item.number}</a></li>)}
            {company.publicAgency?.email && <li><a className="hover:underline wrap-anywhere" href={'mailto:' + company.publicAgency.email}>{company.publicAgency.email}</a></li>}
            {company.publicAgency?.website && <li><a className="hover:underline" href={company.publicAgency.website}>Site officiel</a></li>}
            {company.publicAgency && Object.entries(company.publicAgency.socialLinks).map(([name, url]) => url &&
              <li key={name}><a className="capitalize hover:underline" href={url}>{name}</a></li>)}

            <li><Link className="hover:underline" to="/contact">Nous contacter</Link></li>
            <li><Link className="hover:underline" to="/assistance">Service d’assistance</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/20">
        <div className="site-container flex flex-wrap justify-between gap-3 py-5 text-sm text-blue-100">
          <span>© {company.name}</span>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2">{policyNavigation.map(link => <Link key={link.to} className="hover:underline" to={link.to}>{link.label}</Link>)}</nav>
        </div>
      </div>
    </footer>
  )
}
