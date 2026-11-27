import { Link } from 'react-router-dom'
import { LegalArticle } from '../../../components/public/LegalArticle'
import { company } from '../../../config/company'

export default function PrivacyPolicy() {
  return (
    <LegalArticle title="Politique de confidentialité">
      <h2>1. Collecte des données personnelles</h2>
      <p>Les formulaires de cette démonstration ne transmettent aucune donnée. Saisissez uniquement des exemples fictifs et évitez les renseignements médicaux ou d’identité.</p>
      <h2>2. Finalité du traitement</h2>
      <p>Les futurs formulaires sont prévus pour répondre aux demandes de devis, de contact et d’assistance.</p>
      <h2>3. Conservation et protection</h2>
      <p>Les durées de conservation et modalités de traitement seront définies dans la notice approuvée avant l’ouverture des formulaires.</p>
      <h2>4. Vos droits et contact</h2>
      <p>Pour joindre l’agence, utilisez le <a href={company.office.href} className="text-link">{company.office.number}</a>. Le contact dédié à la confidentialité reste à confirmer.</p>
      <p><Link to="/politique-de-cookies" className="text-link">Politique de cookies</Link></p>
    </LegalArticle>
  )
}
