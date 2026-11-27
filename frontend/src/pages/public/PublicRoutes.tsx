import { Route } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import Home from './Home/Home'
import InsuranceCatalog from './InsuranceCatalog/InsuranceCatalog'
import AutoInsurance from './AutoInsurance/AutoInsurance'
import HomeInsurance from './HomeInsurance/HomeInsurance'
import HealthInsurance from './HealthInsurance/HealthInsurance'
import TravelInsurance from './TravelInsurance/TravelInsurance'
import BusinessInsurance from './BusinessInsurance/BusinessInsurance'
import LiabilityInsurance from './LiabilityInsurance/LiabilityInsurance'
import QuoteRequest from './QuoteRequest/QuoteRequest'
import Individuals from './Individuals/Individuals'
import Professionals from './Professionals/Professionals'
import About from './About/About'
import Contact from './Contact/Contact'
import Assistance from './Assistance/Assistance'
import Faq from './Faq/Faq'
import LegalNotice from './LegalNotice/LegalNotice'
import PrivacyPolicy from './PrivacyPolicy/PrivacyPolicy'
import CookiePolicy from './CookiePolicy/CookiePolicy'
import NotFound from './NotFound/NotFound'

export const publicRoutes = (
  <Route element={<PublicLayout />}>
    <Route index element={<Home />} />
    <Route path="assurances" element={<InsuranceCatalog />} />
    <Route path="assurances/automobile" element={<AutoInsurance />} />
    <Route path="assurances/habitation" element={<HomeInsurance />} />
    <Route path="assurances/sante" element={<HealthInsurance />} />
    <Route path="assurances/voyage" element={<TravelInsurance />} />
    <Route path="assurances/professionnelle" element={<BusinessInsurance />} />
    <Route path="assurances/responsabilite-civile" element={<LiabilityInsurance />} />
    <Route path="devis" element={<QuoteRequest />} />
    <Route path="particuliers" element={<Individuals />} />
    <Route path="professionnels" element={<Professionals />} />
    <Route path="a-propos" element={<About />} />
    <Route path="contact" element={<Contact />} />
    <Route path="assistance" element={<Assistance />} />
    <Route path="faq" element={<Faq />} />
    <Route path="mentions-legales" element={<LegalNotice />} />
    <Route path="politique-de-confidentialite" element={<PrivacyPolicy />} />
    <Route path="politique-de-cookies" element={<CookiePolicy />} />
    <Route path="*" element={<NotFound />} />
  </Route>
)
