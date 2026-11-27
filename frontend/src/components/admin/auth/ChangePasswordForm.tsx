import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../../services/api'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Fields'
import { ErrorState } from '../../ui/States'
import { authError, useAdminSession } from './AdminSession'

export function ChangePasswordForm() {
  const { state, signedOut } = useAdminSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const form = event.currentTarget
    const values = new FormData(form)
    if (values.get('newPassword') !== values.get('confirmation')) {
      setError('Les deux mots de passe doivent être identiques.')
      form.querySelector<HTMLInputElement>('[name="confirmation"]')?.focus()
      return
    }

    setError('')
    setBusy(true)
    try {
      await api.changePassword({
        currentPassword: String(values.get('currentPassword')),
        newPassword: String(values.get('newPassword')),
      }, state.user.csrfToken)
      form.reset()
      signedOut()
      navigate('/admin/login', { replace: true, state: { passwordUpdated: true } })
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) signedOut()
      else setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={change}>
      <Input label="Mot de passe actuel" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
      <Input label="Nouveau mot de passe" name="newPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={128} hint="15 caractères au minimum." />
      <Input label="Confirmer le mot de passe" name="confirmation" type="password" autoComplete="new-password" required maxLength={128} />
      {error && <ErrorState>{error}</ErrorState>}
      <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</Button>
    </form>
  )
}
