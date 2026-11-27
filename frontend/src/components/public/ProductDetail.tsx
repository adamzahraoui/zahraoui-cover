import { useCallback } from 'react'
import { FileText, Headset, ShieldCheck, Users } from 'lucide-react'
import { ActionBand, Accordion, ContentCard, MediaPlaceholder } from './PublicSections'
import { ActionLink, Button } from '../ui/Button'
import { Breadcrumb } from '../ui/Breadcrumb'
import { InsuranceCard } from './InsuranceCard'
import { company } from '../../config/company'
import type { ProductSlug } from '../../config/navigation'
import { getInsurance } from '../../data/insurance'
import { useApiData } from '../../hooks/useApiData'
import { ApiError, api } from '../../services/api'
import { EmptyState, ErrorState, LoadingState } from '../ui/States'
import { usePublicCatalog } from './PublicCatalog'

export function ProductDetail({ slug }: { slug: ProductSlug }) {
  const load = useCallback((signal: AbortSignal) => api.product(slug, signal), [slug])
  const { data: product, error, reload } = useApiData(load)
  const { data: products = [] } = usePublicCatalog()
  if (!product) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <section className="site-container section-space grid gap-4">
        <h1 className="display-title">{missing ? 'Assurance indisponible' : 'Détail de l’assurance'}</h1>
        {missing ? <EmptyState>Cette catégorie n’est pas disponible actuellement. <ActionLink to="/assurances">Voir le catalogue</ActionLink></EmptyState>
          : error ? <ErrorState>Le détail ne peut pas être chargé. <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>
            : <LoadingState />}
      </section>
    )
  }

  const quoteUrl = `/devis?type=${slug}`
  const related = products.filter(item => product.relatedSlugs.includes(item.slug))
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container grid gap-6 py-8 lg:gap-8 lg:py-12">
          <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Nos assurances', to: '/assurances' }, { label: product.title }]} />
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="grid justify-items-start gap-4">
              <h1 className="display-title">{product.title}</h1>
              <p className="max-w-xl text-lg leading-7 text-muted">{product.summary}</p>
              <div className="flex flex-wrap gap-3">
                <ActionLink to={quoteUrl}>Demander un devis</ActionLink>
                <ActionLink to={company.office.href} variant="secondary">{company.office.number}</ActionLink>
              </div>
            </div>
            <MediaPlaceholder icon={getInsurance(slug).icon} className="aspect-[2.4] lg:aspect-[2]" />
          </div>
        </div>
      </section>

      <div className="site-container section-space grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
        <div className="grid content-start gap-7">
          <section>
            <h2 className="section-title">Garanties potentielles</h2>
            <p className="mt-2 text-muted">Exemples à étudier selon les conditions et exclusions du contrat proposé par l’assureur.</p>
            {product.potentialCoverages.length > 0 && <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {product.potentialCoverages.map((item, index) => <li key={index} className="panel flex items-start gap-3 p-4">
                <ShieldCheck size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div><p className="font-semibold">{item.title}</p>{item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}</div>
              </li>)}
            </ul>}
          </section>
          {product.faqs.length > 0 && <section className="grid gap-3"><h2 className="text-xl font-semibold">Questions fréquentes</h2>
            {product.faqs.map((faq, index) => <Accordion key={index} question={faq.question}>{faq.answer}</Accordion>)}
          </section>}
        </div>
        <aside aria-label="Informations sur la catégorie" className="grid content-start gap-3">
          <ContentCard title="À qui s’adresse cette offre ?" icon={Users}>{product.eligibilityText || product.audiences.map(value => value === 'INDIVIDUAL' ? 'Particuliers' : 'Professionnels').join(' · ')}</ContentCard>
          {product.documentHints.length > 0 && <ContentCard title="Documents pouvant être requis" icon={FileText}><ul className="list-disc pl-4">{product.documentHints.map((text, index) => <li key={index}>{text}</li>)}</ul></ContentCard>}
          <ContentCard title="Besoin d’aide ?" icon={Headset}><a href={company.office.href} className="text-link">{company.office.number}</a></ContentCard>
        </aside>
      </div>

      {related.length > 0 && <section className="border-t border-line bg-white">
        <div className="site-container section-space"><h2 className="section-title mb-6">Assurances associées</h2><div className="grid gap-4 md:grid-cols-3">{related.map(item => <InsuranceCard key={item.slug} product={item} />)}</div></div>
      </section>}
      <ActionBand assistance title="Besoin d’assistance ?">Retrouvez les informations du service d’assistance.</ActionBand>
    </>
  )
}
