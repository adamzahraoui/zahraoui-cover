import { FileQuestion } from 'lucide-react'
import { ActionLink } from '../../../components/ui/Button'

export default function NotFound() {
  return (
    <div className="site-container grid justify-items-center gap-4 py-16 text-center lg:py-24">
      <FileQuestion className="size-12 text-primary" strokeWidth={1.5} aria-hidden />
      <p className="font-bold text-secondary">404</p>
      <h1 className="display-title">Page introuvable.</h1>
      <p className="max-w-lg text-muted">Cette adresse ne correspond à aucune page. Vous pouvez revenir à l’accueil ou poursuivre vers nos assurances.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ActionLink to="/">Retour à l’accueil</ActionLink>
        <ActionLink to="/assurances" variant="secondary">Nos assurances</ActionLink>
        <ActionLink to="/devis" variant="secondary">Demander un devis</ActionLink>
      </div>
    </div>
  )
}
