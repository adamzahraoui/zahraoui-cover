import { PageMain } from './PageMain'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminSidebar } from '../components/admin/AdminSidebar'
import { AdminTopbar } from '../components/admin/AdminTopbar'

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  return (
    <div className="flex min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:bg-white focus:p-3">Aller au contenu</a>
      {sidebarOpen && <AdminSidebar />}
      <div className="min-w-0 flex-1">
        <AdminTopbar sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(open => !open)} />
        <PageMain className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </PageMain>
      </div>
    </div>
  )
}
