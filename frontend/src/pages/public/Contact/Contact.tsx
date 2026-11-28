import { Headset, Phone } from 'lucide-react'
import { IntakeForm } from '../../../components/public/IntakeForm'
import { ContentCard, PageHeading } from '../../../components/public/PublicSections'
import { useCompany } from '../../../config/CompanyProvider'

export default function Contact() {
  const company = useCompany()
  return (
    <>
      <PageHeading title={`Contactez ${company.name}`} description="Appelez l’agence ou utilisez le formulaire de contact." />
      <div className="site-container section-space grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <IntakeForm mode="contact" />
        <aside className="grid gap-3" aria-label="Informations de l’agence">
          <h2 className="text-xl font-bold">Informations de l’agence</h2>
          <ContentCard title={company.office.label} icon={Phone}><a href={company.office.href} className="text-link">{company.office.number}</a></ContentCard>
          <ContentCard title={company.assistance.label} icon={Headset}><a href={company.assistance.href} className="text-link">{company.assistance.number}</a></ContentCard>
          {company.publicAgency?.email && <ContentCard title="Email officiel" icon={Phone}><a className="text-link wrap-anywhere" href={'mailto:' + company.publicAgency.email}>{company.publicAgency.email}</a></ContentCard>}
          {(company.publicAgency?.address || company.publicAgency?.city || company.publicAgency?.hours) && <ContentCard title="Adresse et horaires" icon={Phone}>
            {[company.publicAgency.address, company.publicAgency.city, company.publicAgency.hours].filter(Boolean).map(value => <p key={value}>{value}</p>)}
          </ContentCard>}
          {company.publicAgency?.whatsappPhone && <ContentCard title="WhatsApp" icon={Phone}><a className="text-link" href={'https://wa.me/' + company.publicAgency.whatsappPhone.slice(1)}>Contacter l’agence sur WhatsApp</a></ContentCard>}

        </aside>
      </div>
    </>
  )
}
