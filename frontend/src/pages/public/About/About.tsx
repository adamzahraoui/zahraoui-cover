import { Handshake, HeartHandshake, Search, Target } from 'lucide-react'
import { ActionBand, ContentCard, MediaPlaceholder, PageHeading } from '../../../components/public/PublicSections'
import { ActionLink } from '../../../components/ui/Button'
import { company } from '../../../config/company'

const principles = [
  { title: 'Notre mission', icon: Target, copy: 'Écouter vos besoins pour vous aider à comparer les solutions d’assurance.' },
  { title: 'Notre vision', icon: Search, copy: 'Rendre les démarches et les conditions des assurances plus faciles à comprendre.' },
  { title: 'Nos valeurs', icon: HeartHandshake, copy: 'Privilégier le conseil, la clarté et l’accompagnement.' },
]

export default function About() {
  return (
    <>
      <PageHeading title={`À propos de ${company.name}`} description={`${company.descriptor} au Maroc pour les particuliers et les professionnels.`} />
      <section className="site-container section-space grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
        <MediaPlaceholder icon={Handshake} className="aspect-[1.9]" />
        <div className="grid justify-items-start gap-4">
          <h2 className="section-title text-primary">Notre rôle de courtier en assurances</h2>
          <p className="leading-7 text-muted">Nous vous aidons à identifier vos besoins et à comprendre les solutions des assureurs, de la première prise de contact à l’examen des conditions du contrat.</p>
          <ActionLink to="/contact" variant="secondary">Nous contacter</ActionLink>
        </div>
      </section>
      <section className="border-t border-line bg-white">
        <div className="site-container section-space"><h2 className="section-title mb-5">Notre approche d’accompagnement</h2><div className="grid gap-4 md:grid-cols-3">{principles.map(({ title, icon, copy }) => <ContentCard key={title} title={title} icon={icon}>{copy}</ContentCard>)}</div></div>
      </section>
      <ActionBand title="Échangeons sur votre projet">Un conseiller peut vous aider à orienter votre recherche.</ActionBand>
    </>
  )
}
