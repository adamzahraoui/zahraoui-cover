import { FileText, Headset, ShieldCheck, Users } from 'lucide-react'
import { ActionBand, Accordion, ContentCard, MediaPlaceholder } from './PublicSections'
import { ActionLink } from '../ui/Button'
import { Breadcrumb } from '../ui/Breadcrumb'
import { InsuranceCard } from './InsuranceCard'
import { company } from '../../config/company'
import type { ProductSlug } from '../../config/navigation'
import { getInsurance, insurance } from '../../data/insurance'

export function ProductDetail({ slug }: { slug: ProductSlug }) {
  const product = getInsurance(slug)
  const quoteUrl = `/devis?type=${slug}`
  const related = insurance.filter(item => item.slug !== slug && item.audiences.some(audience => product.audiences.includes(audience))).slice(0, 3)
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container grid gap-6 py-8 lg:gap-8 lg:py-12">
          <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Nos assurances', to: '/assurances' }, { label: product.label }]} />
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="grid justify-items-start gap-4">
              <h1 className="display-title">{product.label}</h1>
              <p className="max-w-xl text-lg leading-7 text-muted">{product.summary}</p>
              <div className="flex flex-wrap gap-3">
                <ActionLink to={quoteUrl}>Demander un devis</ActionLink>
                <ActionLink to={company.office.href} variant="secondary">{company.office.number}</ActionLink>
              </div>
            </div>
            <MediaPlaceholder icon={product.icon} className="aspect-[2.4] lg:aspect-[2]" />
          </div>
        </div>
      </section>

      <div className="site-container section-space grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
        <div className="grid content-start gap-7">
          <section>
            <h2 className="section-title">Garanties potentielles</h2>
            <p className="mt-2 text-muted">Exemples à étudier selon les conditions et exclusions du contrat proposé par l’assureur.</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {product.potential.map(item => <li key={item} className="panel flex items-center gap-3 p-4 font-semibold"><ShieldCheck size={19} className="shrink-0 text-primary" aria-hidden />{item}</li>)}
            </ul>
          </section>
          <section className="grid gap-3"><h2 className="text-xl font-semibold">Questions fréquentes</h2><Accordion question={product.question}>{product.answer}</Accordion></section>
        </div>
        <aside aria-label="Informations sur la catégorie" className="grid content-start gap-3">
          <ContentCard title="À qui s’adresse cette offre ?" icon={Users}>{product.audienceText}</ContentCard>
          <ContentCard title={slug === 'sante' ? 'Confidentialité' : 'Documents pouvant être requis'} icon={FileText}>{product.documents}</ContentCard>
          <ContentCard title="Besoin d’aide ?" icon={Headset}><a href={company.office.href} className="text-link">{company.office.number}</a></ContentCard>
        </aside>
      </div>

      <section className="border-t border-line bg-white">
        <div className="site-container section-space"><h2 className="section-title mb-6">Assurances associées</h2><div className="grid gap-4 md:grid-cols-3">{related.map(item => <InsuranceCard key={item.slug} product={item} />)}</div></div>
      </section>
      <ActionBand assistance title="Besoin d’assistance ?">Retrouvez les informations du service d’assistance.</ActionBand>
    </>
  )
}
