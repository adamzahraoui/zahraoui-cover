import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthLayout } from '../../../layouts/AuthLayout'
import { ApiError, api } from '../../../services/api'
import type { Auth } from '../../../types/api'
import { Button } from '../../ui/Button'
import { ErrorState, LoadingState } from '../../ui/States'

type SessionState =
  | { status: 'loading' | 'anonymous' | 'unavailable' }
  | { status: 'authenticated'; user: Auth }

const Context = createContext<{
  state: SessionState
  refresh: () => void
  signedIn: (user: Auth) => void
  signedOut: () => void
} | null>(null)

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const currentRequest = useRef<AbortController | undefined>(undefined)

  const refresh = useCallback(() => {
    currentRequest.current?.abort()
    const request = new AbortController()
    currentRequest.current = request
    api.session(request.signal).then(user => {
      if (!request.signal.aborted) setState({ status: 'authenticated', user })
    }).catch((error: unknown) => {
      if (!request.signal.aborted) {
        setState({ status: error instanceof ApiError && error.status === 401 ? 'anonymous' : 'unavailable' })
      }
    })
  }, [])

  useEffect(() => {
    refresh()
    return () => currentRequest.current?.abort()
  }, [pathname, refresh])

  useEffect(() => {
    if (state.status !== 'authenticated') return
    const remaining = new Date(state.user.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(() => {
      currentRequest.current?.abort()
      setState({ status: 'anonymous' })
    }, Math.max(0, remaining))
    // Returning to the tab counts as activity and also detects logout in another tab.
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [state, refresh])

  function signedIn(user: Auth) {
    currentRequest.current?.abort()
    setState({ status: 'authenticated', user })
  }

  function signedOut() {
    currentRequest.current?.abort()
    setState({ status: 'anonymous' })
  }

  return <Context.Provider value={{ state, refresh, signedIn, signedOut }}>{children}</Context.Provider>
}

export function useAdminSession() {
  const context = useContext(Context)
  if (!context) throw new Error('Le contexte de session est indisponible.')
  return context
}

export function RequireAdminSession() {
  const { state, refresh } = useAdminSession()
  const location = useLocation()
  if (state.status === 'loading') return <AuthLayout><LoadingState /></AuthLayout>
  if (state.status === 'unavailable') return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-primary">Espace Administration</h1>
      <ErrorState>La vérification de la session est temporairement indisponible.</ErrorState>
      <Button onClick={refresh}>Réessayer</Button>
    </AuthLayout>
  )
  if (state.status !== 'authenticated') {
    return <Navigate to="/admin/login" replace state={{ returnTo: location.pathname + location.search }} />
  }
  return <Outlet />
}

export function RequireAdminRole() {
  const { state } = useAdminSession()
  if (state.status === 'authenticated' && state.user.role === 'ADMIN') return <Outlet />
  return (
    <>
      <h1 className="text-2xl font-bold text-primary">Accès réservé</h1>
      <ErrorState>Cette page est réservée aux administrateurs.</ErrorState>
    </>
  )
}

export function afterLogin(state: unknown) {
  const destination = typeof state === 'object' && state !== null && 'returnTo' in state ? state.returnTo : ''
  if (typeof destination === 'string' && destination.startsWith('/admin/')) {
    const target = new URL(destination, window.location.origin)
    if (target.origin === window.location.origin && target.pathname.startsWith('/admin/') &&
        !/^\/admin\/(login|mot-de-passe-oublie|reinitialiser-mot-de-passe)(\/|$)/.test(target.pathname)) {
      return target.pathname + target.search
    }
  }
  return '/admin/dashboard'
}

export function authError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Le service est temporairement indisponible. Réessayez dans un instant.'
  switch (error.code) {
    case 'INVALID_CREDENTIALS': return 'Adresse email ou mot de passe incorrect.'
    case 'RATE_LIMITED': return 'Trop de tentatives. Réessayez plus tard.'
    case 'RESET_INVALID': return 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.'
    case 'CURRENT_PASSWORD_INVALID': return 'Le mot de passe actuel est incorrect.'
    case 'UNAUTHENTICATED': return 'Votre session a expiré. Connectez-vous à nouveau.'
    case 'CSRF_FAILED': return 'La vérification de la requête a échoué. Actualisez la page.'
    case 'VALIDATION_FAILED': return 'Vérifiez les champs du formulaire.'
    default: return 'Le service est temporairement indisponible. Réessayez dans un instant.'
  }
}
