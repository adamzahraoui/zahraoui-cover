import { Headset, Phone } from 'lucide-react'
import { IntakeForm } from '../../../components/public/IntakeForm'
import { ContentCard } from '../../../components/public/PublicSections'
import { ActionLink } from '../../../components/ui/Button'
import { Breadcrumb } from '../../../components/ui/Breadcrumb'
import { useCompany } from '../../../config/CompanyProvider'

export default function Assistance() {
  const company = useCompany()
  return (
    <>
      <section className="bg-primary text-white">
        <div className="site-container grid justify-items-start gap-4 py-9 lg:py-12">
          <div className="[&_nav]:text-blue-100"><Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Assistance' }]} /></div>
          <p className="flex items-center gap-2 text-sm font-semibold"><Headset size={19} aria-hidden /> {company.assistance.label}</p>
          <h1 className="text-3xl font-bold lg:text-[44px]"><a className="hover:underline" href={company.assistance.href}>{company.assistance.number}</a></h1>
          <p className="max-w-xl text-blue-100">Pour être orienté en cas d’incident, contactez le service d’assistance.</p>
          <ActionLink to={company.assistance.href} variant="light"><Phone size={16} aria-hidden /> Appeler l’assistance</ActionLink>
        </div>
      </section>
      <div className="site-container section-space grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <IntakeForm mode="assistance" />
        <ContentCard title="Que faire en cas d’incident ?" icon={Phone}>
          <p>Gardez la référence de votre contrat à portée de main si vous l’avez. Appelez le numéro d’assistance pour connaître les démarches liées à votre situation.</p>
          <p>En cas d’urgence, contactez directement les services de secours. Le formulaire en ligne ne remplace pas cet appel.</p>
        </ContentCard>
      </div>
    </>
  )
}
