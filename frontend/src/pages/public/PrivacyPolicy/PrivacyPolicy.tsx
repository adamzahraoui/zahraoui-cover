import { Link } from 'react-router-dom'
import { LegalArticle } from '../../../components/public/LegalArticle'
import { company } from '../../../config/company'

export default function PrivacyPolicy() {
  return (
    <LegalArticle title="Politique de confidentialité">
      <h2>1. Collecte des données personnelles</h2>
      <p>Le formulaire de demande de devis transmet les informations nécessaires à l’étude de votre besoin et à la prise de contact lorsque la notice de collecte est disponible. Évitez les renseignements médicaux ou d’identité. Les formulaires de contact et d’assistance restent des démonstrations.</p>
      <p>L’espace d’administration utilise l’adresse professionnelle, le nom affiché et les données de session des membres autorisés de l’équipe pour gérer leur accès.</p>
      <h2>2. Finalité du traitement</h2>
      <p>La notice de collecte est présentée avant l’envoi d’une demande de devis. Les informations servent à étudier la demande et à vous recontacter.</p>
      <h2>3. Conservation et protection</h2>
      <p>Les durées de conservation et modalités de traitement seront définies dans la notice approuvée avant l’ouverture des formulaires.</p>
      <h2>4. Vos droits et contact</h2>
      <p>Pour joindre l’agence, utilisez le <a href={company.office.href} className="text-link">{company.office.number}</a>. Le contact dédié à la confidentialité reste à confirmer.</p>
      <p><Link to="/politique-de-cookies" className="text-link">Politique de cookies</Link></p>
    </LegalArticle>
  )
}
