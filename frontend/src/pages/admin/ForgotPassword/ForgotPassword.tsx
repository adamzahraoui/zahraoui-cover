import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { authError } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { api } from '../../../services/api'

export default function ForgotPassword() {
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    setBusy(true)
    setMessage('')
    try {
      await api.forgotPassword(String(new FormData(form).get('email')))
      setAccepted(true)
      form.reset()
    } catch (error) {
      setMessage(authError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <div><h1 className="text-2xl font-bold text-primary">Mot de passe oublié</h1><p className="mt-2 text-sm text-muted">Indiquez votre adresse email professionnelle pour demander un lien de réinitialisation.</p></div>
      {accepted ? <LocalFeedback>Si un compte actif correspond à cette adresse, un lien de réinitialisation pourra vous être envoyé.</LocalFeedback> : (
        <form onSubmit={send} className="grid gap-4">
          <Input label="Email professionnel" name="email" type="email" required maxLength={254} autoComplete="email" />
          <Button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Demander un lien'}</Button>
        </form>
      )}
      {message && <ErrorState>{message}</ErrorState>}
      <Link to="/admin/login" className="text-link text-sm">Retour à la connexion</Link>
    </AuthLayout>
  )
}
