import { Menu } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../ui/Dialog'
import { AdminNavigation } from './AdminSidebar'

export function AdminTopbar({ sidebarOpen, onToggle }: { sidebarOpen: boolean; onToggle: () => void }) {
  const menu = useRef<HTMLDialogElement>(null)
  return (
    <>
      <header className="flex min-h-17 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 text-primary">
          <button type="button" aria-label="Basculer la barre latérale" aria-expanded={sidebarOpen} className="hidden rounded p-2 hover:bg-background lg:inline-flex" onClick={onToggle}><Menu size={21} /></button>
          <button type="button" aria-label="Ouvrir le menu d’administration" className="rounded p-2 hover:bg-background lg:hidden" onClick={() => menu.current?.showModal()}><Menu size={21} /></button>
          <span className="font-semibold">Administration</span>
        </div>
        <Link to="/admin/login" className="text-link text-sm">Connexion</Link>
      </header>
      <Dialog title="Administration" dialogRef={menu}>
        <div className="rounded bg-primary p-2 text-white"><AdminNavigation onNavigate={() => menu.current?.close()} /></div>
      </Dialog>
    </>
  )
}
