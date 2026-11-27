import { Building2, ClipboardList, FileCheck2, FileText, Handshake, Headset, LayoutDashboard, Mail, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Brand } from '../public/Brand'

const items = [
  { to: '/admin/dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
  { to: '/admin/demandes', label: 'Demandes de devis', Icon: ClipboardList },
  { to: '/admin/clients', label: 'Clients', Icon: Users },
  { to: '/admin/devis', label: 'Devis', Icon: FileText },
  { to: '/admin/contrats', label: 'Contrats', Icon: FileCheck2 },
  { to: '/admin/assistance', label: 'Assistance', Icon: Headset },
  { to: '/admin/assurances', label: 'Assurances', Icon: Building2 },
  { to: '/admin/partenaires', label: 'Partenaires', Icon: Handshake },
  { to: '/admin/messages', label: 'Messages', Icon: Mail },
  { to: '/admin/parametres', label: 'Paramètres', Icon: Settings },
]

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Administration" className="grid gap-1">
      {items.map(({ to, label, Icon }) => (
        <NavLink to={to} key={to} onClick={onNavigate} className="flex min-h-11 min-w-0 items-center gap-3 rounded p-3 text-sm font-medium hover:bg-white/12 aria-[current=page]:bg-white/20">
          <Icon size={17} className="shrink-0" aria-hidden />{label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 bg-primary px-4 py-6 text-white lg:block">
      <div className="sticky top-6">
        <div className="mb-7 px-3"><Brand to="/admin/dashboard" light /></div>
        <AdminNavigation />
      </div>
    </aside>
  )
}
