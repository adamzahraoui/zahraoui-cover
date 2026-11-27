import { useRef } from 'react'
import { LegalArticle } from '../../../components/public/LegalArticle'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'

export default function CookiePolicy() {
  const preferences = useRef<HTMLDialogElement>(null)
  return (
    <LegalArticle title="Politique de cookies">
      <h2>Cookies essentiels</h2>
      <p>Un cookie essentiel maintient la connexion des membres de l’équipe dans l’espace d’administration. La session expire après 30 minutes d’inactivité ou 12 heures au maximum. La déconnexion supprime le cookie de session.</p>
      <h2>Cookies analytiques</h2>
      <p>Aucun outil de mesure d’audience ni cookie optionnel n’est activé.</p>
      <Button variant="secondary" onClick={() => preferences.current?.showModal()}>Voir les préférences</Button>
      <Dialog title="Préférences de cookies" dialogRef={preferences}>
        <p>Il n’y a aucun cookie optionnel à configurer dans cet aperçu.</p>
        <Button className="mt-4" onClick={() => preferences.current?.close()}>Compris</Button>
      </Dialog>
    </LegalArticle>
  )
}
