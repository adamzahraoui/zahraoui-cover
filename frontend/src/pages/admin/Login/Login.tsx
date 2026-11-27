import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { afterLogin, authError, useAdminSession } from '../../../components/admin/auth/AdminSession'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { api } from '../../../services/api'

export default function Login() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const { state, signedIn } = useAdminSession()
  const location = useLocation()
  const locationState: unknown = location.state
  const passwordUpdated = typeof locationState === 'object' && locationState !== null && 'passwordUpdated' in locationState && locationState.passwordUpdated === true

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    setMessage('')
    setBusy(true)
    try {
      signedIn(await api.login({ email: String(values.get('email')), password: String(values.get('password')) }))
      form.reset()
    } catch (error) {
      setMessage(authError(error))
    } finally {
      setVisible(false)
      setBusy(false)
    }
  }

  if (state.status === 'authenticated') return <Navigate to={afterLogin(locationState)} replace />

  return (
    <AuthLayout>
      <div><h1 className="text-2xl font-bold text-primary">Espace Administration</h1><p className="mt-2 text-sm text-muted">Connexion réservée à l’équipe de courtage.</p></div>
      {passwordUpdated && <LocalFeedback>Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.</LocalFeedback>}
      <form onSubmit={login} className="grid gap-4">
        <Input label="Adresse email professionnelle" name="email" type="email" maxLength={254} required autoComplete="username" />
        <div className="grid gap-2">
          <Input label="Mot de passe" name="password" type={visible ? 'text' : 'password'} maxLength={128} required autoComplete="current-password" />
          <button type="button" className="text-link inline-flex w-fit items-center gap-2 text-sm" onClick={() => setVisible(value => !value)}>
            {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}{visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          </button>
        </div>
        <Button type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</Button>
      </form>
      {message && <ErrorState>{message}</ErrorState>}
      <Link to="/admin/mot-de-passe-oublie" className="text-link text-sm">Mot de passe oublié ?</Link>
    </AuthLayout>
  )
}
