import { House } from 'lucide-react'
import { MediaPlaceholder, ActionBand } from '../../../components/public/PublicSections'
import { CatalogCards, usePublicCatalog } from '../../../components/public/PublicCatalog'
import { ActionLink } from '../../../components/ui/Button'
import { Breadcrumb } from '../../../components/ui/Breadcrumb'


export default function Individuals() {
  const featured = (usePublicCatalog().data ?? []).filter(item => item.audiences.includes('INDIVIDUAL'))
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="site-container grid gap-5 py-8 lg:py-12">
          <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Particuliers' }]} />
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div className="grid justify-items-start gap-4">
              <h1 className="display-title">Protégez ce qui compte pour vous et votre famille.</h1>
              <p className="leading-7 text-muted">Renseignez-vous sur les solutions liées à votre logement, vos véhicules, votre santé ou vos voyages.</p>
              <ActionLink to="/devis?profil=particulier">Demander un devis</ActionLink>
            </div>
            <MediaPlaceholder icon={House} className="aspect-[2]" />
          </div>
        </div>
      </section>
      <section className="site-container section-space">
        <h2 className="section-title mb-6">Nos solutions pour les particuliers</h2>
        <CatalogCards products={featured} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" />
      </section>
      <ActionBand title="Un accompagnement personnalisé">Présentez votre situation à un conseiller pour préciser les options à examiner.</ActionBand>
    </>
  )
}
