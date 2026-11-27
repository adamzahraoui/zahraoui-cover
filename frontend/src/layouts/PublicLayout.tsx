import { PageMain } from './PageMain'
import { Outlet, useMatch } from 'react-router-dom'
import { Footer } from '../components/public/Footer'
import { Header } from '../components/public/Header'

export function PublicLayout() {
  const quote = useMatch('/devis')
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:bg-white focus:p-3">Aller au contenu</a>
      <Header compact={Boolean(quote)} />
      <PageMain className="flex-1"><Outlet /></PageMain>
      <Footer />
    </div>
  )
}
