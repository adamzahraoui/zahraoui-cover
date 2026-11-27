import { Headset, Phone } from 'lucide-react'
import { IntakeForm } from '../../../components/public/IntakeForm'
import { ContentCard, PageHeading } from '../../../components/public/PublicSections'
import { company } from '../../../config/company'

export default function Contact() {
  return (
    <>
      <PageHeading title={`Contactez ${company.name}`} description="Appelez l’agence ou utilisez l’aperçu du formulaire de contact." />
      <div className="site-container section-space grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <IntakeForm mode="contact" />
        <aside className="grid gap-3" aria-label="Informations de l’agence">
          <h2 className="text-xl font-bold">Informations de l’agence</h2>
          <ContentCard title={company.office.label} icon={Phone}><a href={company.office.href} className="text-link">{company.office.number}</a></ContentCard>
          <ContentCard title={company.assistance.label} icon={Headset}><a href={company.assistance.href} className="text-link">{company.assistance.number}</a></ContentCard>
        </aside>
      </div>
    </>
  )
}
