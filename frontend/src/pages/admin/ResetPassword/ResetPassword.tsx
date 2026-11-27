import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authError, useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { api } from '../../../services/api'

export default function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [error, setError] = useState('')
  const [confirmationError, setConfirmationError] = useState('')
  const [busy, setBusy] = useState(false)
  const { signedOut } = useAdminSession()
  const navigate = useNavigate()
  const hasToken = /^[A-Za-z0-9_-]{43}$/.test(token)

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    if (values.get('password') !== values.get('confirmation')) {
      setConfirmationError('Les deux mots de passe doivent être identiques.')
      form.querySelector<HTMLInputElement>('[name="confirmation"]')?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.resetPassword(token, String(values.get('password')))
      form.reset()
      signedOut()
      navigate('/admin/login', { replace: true, state: { passwordUpdated: true } })
    } catch (failure) {
      setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <div><h1 className="text-2xl font-bold text-primary">Nouveau mot de passe</h1><p className="mt-2 text-sm text-muted">Choisissez le mot de passe de votre compte professionnel.</p></div>
      {hasToken ? (
        <form onSubmit={reset} onChange={() => setConfirmationError('')} className="grid gap-4">
          <Input label="Nouveau mot de passe" name="password" type="password" required minLength={15} maxLength={128} autoComplete="new-password" hint="15 caractères au minimum." />
          <Input label="Confirmer le mot de passe" name="confirmation" type="password" required maxLength={128} error={confirmationError} autoComplete="new-password" />
          <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</Button>
        </form>
      ) : <ErrorState>Ouvrez le lien reçu par email ou demandez un nouveau lien.</ErrorState>}
      {error && <ErrorState>{error}</ErrorState>}
      <Link to="/admin/mot-de-passe-oublie" className="text-link text-sm">Demander un nouveau lien</Link>
      <Link to="/admin/login" className="text-link text-sm">Retour à la connexion</Link>
    </AuthLayout>
  )
}
