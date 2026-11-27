import { BriefcaseBusiness, Building2, CarFront, ClipboardCheck, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionBand, ContentCard, MediaPlaceholder } from '../../../components/public/PublicSections'
import { ActionLink } from '../../../components/ui/Button'
import { Breadcrumb } from '../../../components/ui/Breadcrumb'

const offerings = [
  { title: 'Responsabilité civile professionnelle', to: '/assurances/responsabilite-civile', icon: Scale, copy: 'Explorez les possibilités de couverture liées à votre responsabilité.' },
  { title: 'Protection des locaux commerciaux', to: '/assurances/professionnelle', icon: Building2, copy: 'Identifiez les besoins de protection de vos locaux et équipements.' },
  { title: 'Assurance flotte de véhicules', to: '/assurances/automobile', icon: CarFront, copy: 'Présentez vos besoins liés aux véhicules d’entreprise à un conseiller.' },
  { title: 'Évaluation personnalisée des risques', to: '/devis?profil=professionnel', icon: ClipboardCheck, copy: 'Précisez votre activité et les risques que vous souhaitez examiner.' },
]

export default function Professionals() {
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container grid gap-5 py-8 lg:py-12">
          <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Professionnels' }]} />
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div className="grid justify-items-start gap-4">
              <h1 className="display-title">Sécurisez votre activité et vos équipes.</h1>
              <p className="leading-7 text-muted">Présentez vos besoins professionnels à un courtier pour étudier les couvertures à envisager.</p>
              <ActionLink to="/devis?profil=professionnel">Demander un devis professionnel</ActionLink>
            </div>
            <MediaPlaceholder icon={BriefcaseBusiness} className="aspect-[2]" />
          </div>
        </div>
      </section>
      <section className="site-container section-space">
        <h2 className="section-title mb-6">Solutions pour les professionnels</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{offerings.map(({ title, to, icon, copy }) => <ContentCard key={title} title={title} icon={icon}><p>{copy}</p><Link to={to} className="text-link mt-3 inline-block" aria-label={`Découvrir : ${title}`}>Découvrir</Link></ContentCard>)}</div>
      </section>
      <ActionBand title="Parlons de vos besoins professionnels">Échangez avec l’agence sur la protection de votre activité.</ActionBand>
    </>
  )
}
