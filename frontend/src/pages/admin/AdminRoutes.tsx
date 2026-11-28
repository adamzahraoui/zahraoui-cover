import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminSessionProvider, RequireAdminRole, RequireAdminSession } from '../../components/admin/auth/AdminSession'
import { NoRecord } from '../../components/admin/AdminContent'
import { AdminLayout } from '../../layouts/AdminLayout'
import Login from './Login/Login'
import ForgotPassword from './ForgotPassword/ForgotPassword'
import ResetPassword from './ResetPassword/ResetPassword'

const Dashboard = lazy(() => import('./Dashboard/Dashboard'))
const QuoteRequests = lazy(() => import('./QuoteRequests/QuoteRequests'))
const QuoteRequestDetail = lazy(() => import('./QuoteRequestDetail/QuoteRequestDetail'))
const Clients = lazy(() => import('./Clients/Clients'))
const ClientProfile = lazy(() => import('./ClientProfile/ClientProfile'))
const ClientForm = lazy(() => import('./ClientForm/ClientForm'))
const Quotes = lazy(() => import('./Quotes/Quotes'))
const QuoteCreate = lazy(() => import('./QuoteCreate/QuoteCreate'))
const QuoteDetail = lazy(() => import('./QuoteDetail/QuoteDetail'))
const Contracts = lazy(() => import('./Contracts/Contracts'))
const ImportExport = lazy(() => import('./ImportExport/ImportExport'))
const Documents = lazy(() => import('./Documents/Documents'))
const ContractForm = lazy(() => import('./ContractForm/ContractForm'))
const AssistanceInbox = lazy(() => import('./AssistanceInbox/AssistanceInbox'))
const InsuranceManagement = lazy(() => import('./InsuranceManagement/InsuranceManagement'))
const Partners = lazy(() => import('./Partners/Partners'))
const Messages = lazy(() => import('./Messages/Messages'))
const Settings = lazy(() => import('./Settings/Settings'))

export default function AdminRoutes() {
  return (
    <AdminSessionProvider>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route element={<RequireAdminSession />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="demandes" element={<QuoteRequests />} />
            <Route path="demandes/:id" element={<QuoteRequestDetail />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/nouveau" element={<ClientForm />} />
            <Route path="clients/:id" element={<ClientProfile />} />
            <Route path="clients/:id/modifier" element={<ClientForm />} />
            <Route path="devis" element={<Quotes />} />
            <Route path="devis/nouveau" element={<QuoteCreate />} />
            <Route path="devis/:id" element={<QuoteDetail />} />
            <Route path="contrats" element={<Contracts />} />
            <Route path="contrats/nouveau" element={<ContractForm />} />
            <Route path="contrats/:id" element={<ContractForm />} />
            <Route path="documents" element={<Documents />} />
            <Route path="assistance" element={<AssistanceInbox />} />
            <Route path="assurances" element={<InsuranceManagement />} />
            <Route path="partenaires" element={<Partners />} />
            <Route path="messages" element={<Messages />} />
            <Route element={<RequireAdminRole />}>
              <Route path="import-export" element={<ImportExport />} />
              <Route path="parametres" element={<Settings />} />
            </Route>
            <Route path="*" element={<NoRecord title="Page d’administration introuvable" back="/admin/dashboard" />} />
          </Route>
        </Route>
      </Routes>
    </AdminSessionProvider>
  )
}
