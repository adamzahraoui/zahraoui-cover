import { Link } from 'react-router-dom'
import { LegalArticle } from '../../../components/public/LegalArticle'
import { useCompany } from '../../../config/CompanyProvider'

export default function PrivacyPolicy() {
  const company = useCompany()
  return (
    <LegalArticle title="Politique de confidentialité">
      {company.publicAgency?.content.privacy ? <p className="whitespace-pre-wrap wrap-anywhere">{company.publicAgency.content.privacy}</p> : <>
      <h2>1. Collecte des données personnelles</h2>
      <p>Les formulaires de devis, de contact et d’assistance recueillent les informations nécessaires au traitement de votre demande lorsqu’une notice de collecte est disponible. Évitez les renseignements médicaux ou les documents d’identité.</p>
      <p>L’espace d’administration utilise l’adresse professionnelle, le nom affiché et les données de session des membres autorisés de l’équipe pour gérer leur accès.</p>
      <h2>2. Finalité du traitement</h2>
      <p>Chaque formulaire présente sa notice de collecte avant l’envoi. Les informations servent à étudier votre besoin, traiter votre message ou orienter votre demande d’assistance et, si nécessaire, à vous recontacter.</p>
      <h2>3. Conservation et protection</h2>
      <p>Les durées de conservation et modalités de traitement seront définies dans la notice approuvée avant l’ouverture des formulaires.</p>
      <h2>4. Vos droits et contact</h2>
      <p>Pour joindre l’agence, utilisez le <a href={company.office.href} className="text-link">{company.office.number}</a>. Le contact dédié à la confidentialité reste à confirmer.</p>
      <p><Link to="/politique-de-cookies" className="text-link">Politique de cookies</Link></p>
      </>}
    </LegalArticle>
  )
}
