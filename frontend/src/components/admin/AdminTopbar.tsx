import { Menu } from 'lucide-react'
import { useRef, useState } from 'react'
import { ApiError, api } from '../../services/api'
import { Dialog } from '../ui/Dialog'
import { ErrorState } from '../ui/States'
import { AdminNavigation } from './AdminSidebar'
import { authError, useAdminSession } from './auth/AdminSession'
import { ChangePasswordForm } from './auth/ChangePasswordForm'

export function AdminTopbar({ sidebarOpen, onToggle }: { sidebarOpen: boolean; onToggle: () => void }) {
  const menu = useRef<HTMLDialogElement>(null)
  const passwordDialog = useRef<HTMLDialogElement>(null)
  const [passwordFormKey, setPasswordFormKey] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { state, signedOut } = useAdminSession()

  async function logout() {
    if (busy || state.status !== 'authenticated') return
    setError('')
    setBusy(true)
    try {
      await api.logout(state.user.csrfToken)
      signedOut()
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) signedOut()
      else setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="flex min-h-17 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 text-primary">
          <button type="button" aria-label="Basculer la barre latérale" aria-expanded={sidebarOpen} className="hidden rounded p-2 hover:bg-background lg:inline-flex" onClick={onToggle}><Menu size={21} /></button>
          <button type="button" aria-label="Ouvrir le menu d’administration" className="rounded p-2 hover:bg-background lg:hidden" onClick={() => menu.current?.showModal()}><Menu size={21} /></button>
          <span className="font-semibold">Administration</span>
        </div>
        {state.status === 'authenticated' && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="max-w-55 font-medium wrap-anywhere">{state.user.displayName}</span>
            <button type="button" className="text-link min-h-10" onClick={() => {
              setPasswordFormKey(key => key + 1)
              passwordDialog.current?.showModal()
            }}>Changer le mot de passe</button>
            <button type="button" className="text-link min-h-10" disabled={busy} onClick={logout}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</button>
          </div>
        )}
      </header>
      {error && <div className="px-4 pt-3 sm:px-6"><ErrorState>{error}</ErrorState></div>}
      <Dialog title="Administration" dialogRef={menu}>
        <div className="rounded bg-primary p-2 text-white"><AdminNavigation onNavigate={() => menu.current?.close()} /></div>
      </Dialog>
      <Dialog title="Changer le mot de passe" dialogRef={passwordDialog}>
        <ChangePasswordForm key={passwordFormKey} />
      </Dialog>
    </>
  )
}
