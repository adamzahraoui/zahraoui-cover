import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/ui/States'
import { CompanyProvider } from './config/CompanyProvider'
import { publicRoutes } from './pages/public/PublicRoutes'

const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'))

export function App() {
  return (
    <Suspense fallback={<div className="site-container py-10"><LoadingState /></div>}>
      <CompanyProvider><Routes>
        {publicRoutes}
        <Route path="admin/*" element={<AdminRoutes />} />
      </Routes></CompanyProvider>
    </Suspense>
  )
}
