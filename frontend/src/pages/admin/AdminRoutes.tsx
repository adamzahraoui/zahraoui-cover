import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminSessionProvider, RequireAdminSession } from '../../components/admin/auth/AdminSession'
import { NoRecord } from '../../components/admin/AdminContent'
import { DemoDataProvider } from '../../components/admin/DemoData'
import { AdminLayout } from '../../layouts/AdminLayout'
import Login from './Login/Login'
import ForgotPassword from './ForgotPassword/ForgotPassword'
import ResetPassword from './ResetPassword/ResetPassword'
import Dashboard from './Dashboard/Dashboard'
import QuoteRequests from './QuoteRequests/QuoteRequests'
import QuoteRequestDetail from './QuoteRequestDetail/QuoteRequestDetail'
import Clients from './Clients/Clients'
import ClientProfile from './ClientProfile/ClientProfile'
import ClientForm from './ClientForm/ClientForm'
import Quotes from './Quotes/Quotes'
import QuoteCreate from './QuoteCreate/QuoteCreate'
import QuoteDetail from './QuoteDetail/QuoteDetail'
import Contracts from './Contracts/Contracts'
import ContractForm from './ContractForm/ContractForm'
import AssistanceInbox from './AssistanceInbox/AssistanceInbox'
import InsuranceManagement from './InsuranceManagement/InsuranceManagement'
import Partners from './Partners/Partners'
import Messages from './Messages/Messages'
import Settings from './Settings/Settings'

export default function AdminRoutes() {
  return (
    <AdminSessionProvider>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route element={<RequireAdminSession />}>
          <Route element={<DemoDataProvider><AdminLayout /></DemoDataProvider>}>
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
            <Route path="assistance" element={<AssistanceInbox />} />
            <Route path="assurances" element={<InsuranceManagement />} />
            <Route path="partenaires" element={<Partners />} />
            <Route path="messages" element={<Messages />} />
            <Route path="parametres" element={<Settings />} />
            <Route path="*" element={<NoRecord title="Page d’administration introuvable" back="/admin/dashboard" />} />
          </Route>
        </Route>
      </Routes>
    </AdminSessionProvider>
  )
}
