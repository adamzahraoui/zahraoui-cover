import { Link } from 'react-router-dom'
import { LegalArticle } from '../../../components/public/LegalArticle'
import { useCompany } from '../../../config/CompanyProvider'

export default function LegalNotice() {
  const company = useCompany()
  return (
    <LegalArticle title="Mentions légales">
      {company.publicAgency?.content.legal ? <p className="whitespace-pre-wrap wrap-anywhere">{company.publicAgency.content.legal}</p> : <>
      <h2>1. Éditeur du site</h2>
      <p>{company.name} exerce une activité de courtage en assurances au Maroc. Pour joindre l’agence, appelez le <a href={company.office.href} className="text-link">{company.office.number}</a>.</p>
      <h2>2. Activité de courtage</h2>
      <p>Les contenus du site présentent des catégories de couverture à titre d’information. Les conditions applicables dépendent des contrats proposés par les assureurs.</p>
      <h2>3. Hébergement et propriété intellectuelle</h2>
      <p>Les informations officielles relatives à l’éditeur, à l’hébergement et aux droits d’utilisation seront ajoutées après validation.</p>
      <p><Link to="/politique-de-confidentialite" className="text-link">Politique de confidentialité</Link></p>
      </>}
    </LegalArticle>
  )
}
