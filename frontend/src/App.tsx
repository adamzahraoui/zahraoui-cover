import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/ui/States'
import { publicRoutes } from './pages/public/PublicRoutes'

const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'))

export function App() {
  return (
    <Suspense fallback={<div className="site-container py-10"><LoadingState /></div>}>
      <Routes>
        {publicRoutes}
        <Route path="admin/*" element={<AdminRoutes />} />
      </Routes>
    </Suspense>
  )
}
