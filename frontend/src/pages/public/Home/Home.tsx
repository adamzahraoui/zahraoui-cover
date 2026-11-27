import { BriefcaseBusiness, ClipboardList, Handshake, Headset, House, MessageCircle, Search, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CatalogCards, usePublicCatalog } from '../../../components/public/PublicCatalog'
import { Accordion, ActionBand, ContentCard, MediaPlaceholder } from '../../../components/public/PublicSections'
import { ActionLink } from '../../../components/ui/Button'
import { company } from '../../../config/company'
import { useApiData } from '../../../hooks/useApiData'
import { api } from '../../../services/api'
import { faqs } from '../../../data/faq'

const audiences = [
  { title: 'Solutions pour les particuliers', description: 'Découvrez les assurances pour votre véhicule, votre logement, votre santé et vos déplacements.', to: '/particuliers', icon: House, action: 'Espace particuliers' },
  { title: 'Solutions pour les professionnels', description: 'Identifiez les solutions adaptées aux besoins de votre activité et de vos équipes.', to: '/professionnels', icon: BriefcaseBusiness, action: 'Espace professionnels' },
]

const benefits = [
  { title: 'Accompagnement dédié', copy: 'Un échange pour comprendre votre situation.', icon: Users },
  { title: 'Conseil en assurance', copy: 'Des explications sur les conditions à examiner.', icon: MessageCircle },
  { title: 'Solutions sur mesure', copy: 'Une recherche orientée par votre besoin.', icon: ShieldCheck },
  { title: 'Assistance et suivi', copy: 'Un numéro dédié pour joindre l’assistance.', icon: Headset },
]

const steps = [
  { title: 'Décrivez vos besoins', copy: 'Précisez la couverture recherchée.', icon: ClipboardList },
  { title: 'Demandez un devis', copy: 'Vérifiez votre demande et vos coordonnées.', icon: MessageCircle },
  { title: 'Étudiez les solutions', copy: 'Échangez avec votre conseiller.', icon: Search },
  { title: 'Choisissez en confiance', copy: 'Examinez les conditions avant de vous engager.', icon: Handshake },
]

export default function Home() {
  const { data: products = [] } = usePublicCatalog()
  const { data: partners = [] } = useApiData(api.publicPartners)
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container section-space grid items-center gap-7 lg:grid-cols-2 lg:gap-10">
          <div className="grid justify-items-start gap-4 lg:gap-6">
            <span className="rounded bg-primary-tint px-3 py-1.5 text-sm font-semibold text-primary">Votre courtier en assurances</span>
            <h1 className="display-title max-w-[19ch] text-balance">Votre protection, notre engagement.</h1>
            <p className="max-w-xl text-base leading-7 text-muted lg:text-lg">{company.name} vous accompagne dans la recherche de solutions d’assurance adaptées à vos besoins personnels et professionnels.</p>
            <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
              <ActionLink to="/devis">Demander un devis</ActionLink>
              <ActionLink to="/assurances" variant="secondary">Découvrir nos assurances</ActionLink>
            </div>
          </div>
          <MediaPlaceholder icon={Handshake} className="aspect-[1.9] lg:aspect-auto lg:h-[440px]" />
        </div>
      </section>

      <section className="site-container section-space">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="section-title">Nos solutions d’assurance</h2><p className="mt-2 text-muted">Choisissez une catégorie pour découvrir les possibilités de couverture.</p></div>
          <Link className="text-link text-sm" to="/assurances">Voir toutes les assurances</Link>
        </div>
        <CatalogCards products={products} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" />
      </section>

      {audiences.map(({ title, description, to, icon, action }, index) => (
        <section className="border-y border-line bg-white" key={to}>
          <div className="site-container section-space grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
            <MediaPlaceholder icon={icon} className={`aspect-[2.1] ${index === 1 ? 'lg:order-last' : ''}`} />
            <div className="grid justify-items-start gap-4"><h2 className="section-title text-primary">{title}</h2><p className="leading-7 text-muted">{description}</p><ActionLink to={to} variant="secondary">{action}</ActionLink></div>
          </div>
        </section>
      ))}

      <section className="site-container section-space hidden lg:block">
        <h2 className="section-title mb-6">Pourquoi choisir {company.name} ?</h2>
        <div className="grid grid-cols-4 gap-4">{benefits.map(({ title, copy, icon }) => <ContentCard key={title} title={title} icon={icon}>{copy}</ContentCard>)}</div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="site-container section-space">
          <h2 className="section-title mb-6">Comment obtenir votre devis ?</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ title, copy, icon }, index) => <li key={title}><ContentCard title={`${index + 1}. ${title}`} icon={icon}>{copy}</ContentCard></li>)}
          </ol>
        </div>
      </section>

      <section className="site-container section-space hidden lg:block">
        <h2 className="section-title text-primary">À propos de {company.name}</h2>
        <p className="mt-3 max-w-2xl leading-7 text-muted">Notre rôle de courtier est de vous aider à préciser vos besoins et à examiner les solutions et conditions des assureurs.</p>
        <Link to="/a-propos" className="text-link mt-4 inline-block">Découvrir notre approche</Link>
      </section>

      <section className="border-t border-line bg-white">
        <div className="site-container section-space">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><h2 className="section-title">Questions fréquentes</h2><Link to="/faq" className="text-link text-sm">Voir la FAQ</Link></div>
          <div className="grid gap-3">{faqs.map(({ question, answer }, index) => <div key={question} className={index >= 3 ? 'hidden lg:block' : ''}><Accordion question={question}>{answer}</Accordion></div>)}</div>
        </div>
      </section>
      {partners.length > 0 && <section className="site-container section-space" aria-labelledby="compagnies-partenaires">
        <h2 id="compagnies-partenaires" className="section-title mb-6">Nos compagnies partenaires</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{partners.map(({ name, website }, index) => (
          <li key={name + index} className="panel p-4 font-semibold wrap-anywhere">
            {website ? <a className="text-link" href={website} target="_blank" rel="noopener noreferrer">{name}<span className="sr-only"> (nouvel onglet)</span></a> : name}
          </li>
        ))}</ul>
      </section>}
      <ActionBand title="Parlons de votre protection.">Décrivez votre besoin à un conseiller {company.name}.</ActionBand>
    </>
  )
}
