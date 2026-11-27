# 03 — Frontend page specification

Routes are based on the handoff. Each page has its own folder, such as `frontend/src/pages/public/AutoInsurance/` or `frontend/src/pages/admin/QuoteRequests/`. The `P` and `A` identifiers link the documentation to the Stitch inventory. Separate modes of the same page share a folder. [Export references](14-DESIGN-AUDIT.md) map the IDs to the HTML files. [API contracts](06-API-ENDPOINTS.md) define the payloads and validation rules for the connected release.

The implementation notes under each page describe the React app. Staff authentication, the public catalog, quote intake, staff request management and the dashboard summary are connected. Other business endpoint descriptions remain the target for later phases. See [verification and differences](15-IMPLEMENTATION-STATUS.md).

## How to follow the code

1. Find the route in `PublicRoutes.tsx` or `AdminRoutes.tsx`. The route points to a page component and the layout supplies the shared navigation.
2. Open the linked page file and follow its imports. Props are the values the page passes to a reusable component. For example, `AutoInsurance` passes `slug="automobile"` to `ProductDetail`.
3. Look for `useState` when a value changes on screen. The catalog keeps the selected audience in state and computes the visible cards from the local list. The quote wizard keeps the current step and the visitor’s draft in state. Admin pages share a fixture provider so edits remain visible while navigating within the demo.
4. Use the API handoff under each page when connecting it to data. The service functions are prepared for same-origin requests. Form previews and fixture edits currently run in the browser.

[PageMain](../frontend/src/layouts/PageMain.tsx) sets the browser-tab title from the visible page heading and focuses the main content after the route or its session check becomes visible. Every layout shares the `contenu` landmark. AdminSession restores the server session, redirects unauthenticated visits, and keeps the CSRF value in memory. Staff business pages still read the fixture provider.

## Shared layout, behavior and states

- **PublicLayout** uses the ZC mark, desktop utility/contact bar, primary navigation and footer. Mobile uses the compact header and appropriate action links or drawer. React Router links keep deep links available. Add page titles, breadcrumbs where designed, landmarks, skip link, and route-change focus.
- **AdminLayout** uses the Royal Blue sidebar and top bar with a responsive navigation drawer and keyboard focus restoration. **AuthLayout** is the dedicated public-facing staff entry surface. Redirect /admin to dashboard when authenticated or login otherwise. Protect admin routes using the session endpoint and safe relative return targets. Admin unknown paths use Page introuvable inside the authorized shell.
- **Reusable components** include LogoZC, Button, IconButton, Badge, StatusBanner, Accordion, FilterChips, ProductCard, ProductDetail, Breadcrumb, FormField, Select, TextArea, Checkbox, Stepper, Modal, DataTable, RecordCard, Pagination, PageSkeleton and EmptyState. Use French labels, text alongside status color, native inputs with label association and reduced motion.
- **Shared catalog/product states** show skeletons while loading, bind approved copy after success, omit optional empty sections and show a resettable empty state for a filtered list. Unknown or unpublished product routes show P19. Network failures expose retry. Keep phone links usable.
- **Shared staff list/detail states** show skeleton or progress, truthful empty content, data on success, inline validation and version conflict handling. On stale writes preserve draft locally in memory and reload server data before retry. Distinguish 401 re-auth, 403 restricted action, 404 missing and recoverable network errors. Cancel superseded searches, disable duplicate writes and announce outcomes in a live region.
- **Shared static states** render approved bundled content immediately. No data loading or submission is required. A route-level boundary provides retry or return home on a runtime failure.
- **Forms** validate on blur/advance and at submit. Map API field errors to labels. Keep drafts in React memory, associate error/help text, and temporarily disable duplicate mutation actions. Carry successful records into an explicit confirmation screen or notify in place. Retry uncertain intake submissions with the original key.
- **Responsive baseline** starts from 390px and 1440px references with a primary transition at 1024px. Verify 320px and intermediate widths. Switch dense tables to labeled cards on narrow screens, preserve the same permissions and required actions. Source differences and proposed resolution appear in each entry.

## Public pages

### P01 · Accueil

**Route** `/`

Orient visitors to product, audience and quote paths.

- **Content and components.** Hero, six product cards, two audience features, brokerage benefits, quote steps, agency and partner blocks, FAQ and final CTA. Use PublicLayout, ProductCard and Accordion.
- **Responsive.** Stack cards and editorial features. The mobile export has a shorter FAQ and omits several desktop blocks.
- **Interactions.** Open dropdown/drawer and FAQs, follow audience/product/service links, request quote or use official numbers.
- **Fields and validation.** None.
- **API data.** GET /api/catalog → ProductCard[] for product cards.
- **States.** Render hero and navigation immediately. Show card skeletons, then visible products or an empty catalog message. Retry only the product section on failure.

**Frontend implementation**

- **File.** [Home.tsx](../frontend/src/pages/public/Home/Home.tsx).
- **Component, props and state.** InsuranceCard, MediaPlaceholder, ContentCard, Accordion, ActionBand; no props or local state.
- **Interactions and styling.** Open links and native FAQ disclosures; desktop editorial blocks collapse on mobile. Tailwind grid and white/neutral section bands.
- **Data and API handoff.** Live category cards from the shared catalog provider, with loading and error states. FAQ content is bundled.

### P02 · Nos assurances

**Route** `/assurances`

Browse the six categories by audience.

- **Content and components.** Heading, audience chips, product cards and assistance CTA. Use FilterChips and ProductGrid.
- **Responsive.** Desktop photo-card grid, mobile compact list without the desktop card imagery.
- **Interactions.** Select Toutes, Particuliers or Professionnels, then open product detail or assistance.
- **Fields and validation.** Optional audience filter INDIVIDUAL or BUSINESS.
- **API data.** GET /api/catalog with optional audience → ProductCard[].
- **States.** Show card skeletons, result cards, no‐match with reset action, or retry.

**Frontend implementation**

- **File.** [InsuranceCatalog.tsx](../frontend/src/pages/public/InsuranceCatalog/InsuranceCatalog.tsx).
- **Component, props and state.** Breadcrumb, InsuranceCard, EmptyState. The page owns the selected audience. InsuranceCard receives `product` and the `illustrated` display option.
- **Interactions and styling.** The audience control sits in the introduction above the compact mobile cards and beside the desktop introduction. Filter locally or follow a detail or preselected quote link. Tablet and desktop cards reserve a photo region.
- **Data and API handoff.** Loads published categories from the shared provider and filters the small result set by audience. Renders loading, empty and error states.

### P03 · Assurance automobile

**Route** `/assurances/automobile`

Explain vehicle cover options for individuals and fleets.

- **Content and components.** Shared ProductDetail with RC, collision, theft/fire/glass and assistance examples, eligibility, documents, FAQ and related products.
- **Responsive.** Mobile stacks hero and benefits, combines eligibility/document material and shows related insurance. Keep approved FAQ accessible.
- **Interactions.** Open FAQ or related product and start a quote with type=automobile.
- **Fields and validation.** None.
- **API data.** GET /api/catalog/automobile → Product.
- **States.** Shared product states. Coverage examples stay conditional.

**Frontend implementation**

- **File.** [AutoInsurance.tsx](../frontend/src/pages/public/AutoInsurance/AutoInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug automobile. The page owns no state; native details controls the accordion.
- **Interactions and styling.** Open cover FAQ and related products; pass type=automobile into the wizard. Tailwind split hero and facts sidebar collapse to a stack.
- **Data and API handoff.** Shared ProductDetail loads the live automobile category, handles 404 and uses available related categories.

### P04 · Assurance habitation

**Route** `/assurances/habitation`

Explain household insurance for owners and tenants.

- **Content and components.** Shared ProductDetail showing fire/water, theft, household liability and assistance examples, audience, documents, FAQ and related cards.
- **Responsive.** Mobile stacks content and combines audience/documents. Preserve access to approved FAQs and related links.
- **Interactions.** Open FAQ, related product or quote with type=habitation.
- **Fields and validation.** None.
- **API data.** GET /api/catalog/habitation → Product.
- **States.** Shared product states.

**Frontend implementation**

- **File.** [HomeInsurance.tsx](../frontend/src/pages/public/HomeInsurance/HomeInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug habitation; the page owns no state.
- **Interactions and styling.** Open questions, eligibility and quote preselection. Uses the same responsive product template.
- **Data and API handoff.** Shared ProductDetail loads the live habitation category and handles loading, error and unavailability.

### P05 · Assurance santé

**Route** `/assurances/sante`

Explain private and group health categories and privacy.

- **Content and components.** Shared ProductDetail with potential consultations, pharmacy, hospital, optical/dental and group cover, audience, documents, FAQ and related products.
- **Responsive.** Mobile stacks features and emphasizes confidentiality. Keep approved detail text accessible.
- **Interactions.** Open FAQ or related product and start quote with type=sante.
- **Fields and validation.** None. The quote carries category only and may contain general nonmedical needs.
- **API data.** GET /api/catalog/sante → Product.
- **States.** Shared product states. Show privacy guidance alongside the quote action.

**Frontend implementation**

- **File.** [HealthInsurance.tsx](../frontend/src/pages/public/HealthInsurance/HealthInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug sante; the page owns no state.
- **Interactions and styling.** Open the privacy guidance and quote preselection. The reusable facts rail stacks below coverage on mobile.
- **Data and API handoff.** Shared ProductDetail loads the live health category. The quote form asks visitors to omit medical details.

### P06 · Assurance voyage

**Route** `/assurances/voyage`

Explain possible travel protection.

- **Content and components.** Shared ProductDetail with travel assistance, luggage, abroad and visa certificate examples, audience, documents, FAQ and related links.
- **Responsive.** Mobile hero and condensed coverage list. Retain access to supporting approved sections.
- **Interactions.** Open accordion, related insurance or quote with type=voyage.
- **Fields and validation.** None.
- **API data.** GET /api/catalog/voyage → Product.
- **States.** Shared product states.

**Frontend implementation**

- **File.** [TravelInsurance.tsx](../frontend/src/pages/public/TravelInsurance/TravelInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug voyage; the page owns no state.
- **Interactions and styling.** Open FAQ, review travel examples and preselect voyage. Uses the responsive hero and facts layout.
- **Data and API handoff.** Shared ProductDetail loads the live travel category, with visibility and request states.

### P07 · Assurance professionnelle

**Route** `/assurances/professionnelle`

Orient business owners and independent professionals.

- **Content and components.** Shared ProductDetail with premises, fleet, operating loss and professional liability examples, audience, documents, FAQ and related links.
- **Responsive.** Mobile summary stacks the benefits. Retain access to supporting approved sections.
- **Interactions.** Open FAQ/related link and quote with type=professionnelle.
- **Fields and validation.** None.
- **API data.** GET /api/catalog/professionnelle → Product.
- **States.** Shared product states.

**Frontend implementation**

- **File.** [BusinessInsurance.tsx](../frontend/src/pages/public/BusinessInsurance/BusinessInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug professionnelle; the page owns no state.
- **Interactions and styling.** Open local accordion or a preselected quote. The template uses the same responsive coverage cards.
- **Data and API handoff.** Shared ProductDetail loads the live professional category and available related categories.

### P08 · Responsabilité civile

**Route** `/assurances/responsabilite-civile`

Distinguish personal and business liability categories.

- **Content and components.** Shared ProductDetail with private life, operations, professional liability and legal assistance examples, eligibility, documents, FAQ and related products.
- **Responsive.** Mobile presents condensed coverage; retain access to supporting approved sections.
- **Interactions.** Open FAQ/related product and quote with type=responsabilite-civile.
- **Fields and validation.** None.
- **API data.** GET /api/catalog/responsabilite-civile → Product.
- **States.** Shared product states.

**Frontend implementation**

- **File.** [LiabilityInsurance.tsx](../frontend/src/pages/public/LiabilityInsurance/LiabilityInsurance.tsx).
- **Component, props and state.** ProductDetail receives slug responsabilite-civile; the page owns no state.
- **Interactions and styling.** Open related details or the preselected quote. Split desktop layout and stacked mobile layout share one component.
- **Data and API handoff.** Shared ProductDetail loads the live liability category and handles unavailability.

### P09 · Demande de devis

**Route** `/devis`

Submit a quote request without an account.

- **Content and components.** Four steps: Votre assurance, Vos besoins, Vos coordonnées, Vérification. Stepper, privacy acknowledgement, help rail and confirmation.
- **Responsive.** Tablet/mobile stack into one step at a time. Export only hints at later progression in a shortened view. Extend existing components to the four steps with the same fields and checks.
- **Interactions.** Accept recognized type and profil preselection, edit prior stages, review actual entries, submit once and start a new request only after explicit action.
- **Fields and validation.** Step 1 required profile/product. Step 2 optional desired date and situation plus required needs. Step 3 required first/last name, phone, email, city; optional contact preference. Step 4 required acknowledgement. Follow QuoteRequestIn rules.
- **API data.** GET /api/catalog → ProductCard[]. POST /api/quotes with QuoteRequestIn and idempotency key → reference and receivedAt.
- **States.** Load products; show empty catalog fallback and office number. Disable duplicate submission, show field errors and focus first invalid input. On network failure preserve draft and retry same key. Confirm using persisted reference only.

**Frontend implementation**

- **File.** [QuoteRequest.tsx](../frontend/src/pages/public/QuoteRequest/QuoteRequest.tsx).
- **Component, props and state.** QuoteWizard receives URLSearchParams, owns QuoteDraft, the current step, validation errors and the saved receipt. QuoteFields receives controlled fields and an update callback.
- **Interactions and styling.** Advance and go back, review entered data, acknowledge the notice, send the request, view the persisted reference and start a new request explicitly. Desktop step labels and help rail; mobile numbered steps.
- **Data and API handoff.** Live categories and notice. The typed service sends the category context, needs, notice version and idempotency key. The receipt is shown only after the API succeeds. See [Quote request implementation](19-QUOTE-REQUEST-IMPLEMENTATION.md).

### P10 · Particuliers

**Route** `/particuliers`

Guide families to appropriate insurance categories.

- **Content and components.** Editorial hero, automobile, habitation, santé and voyage feature links, broker guidance and quote CTA.
- **Responsive.** Mobile compacts editorial and uses stacked category links.
- **Interactions.** Select category, start quote or call the office.
- **Fields and validation.** None.
- **API data.** GET /api/catalog?audience=INDIVIDUAL → ProductCard[]. Use the four featured slugs from available products.
- **States.** Shared catalog states within the product section. Maintain CTA navigation when unavailable.

**Frontend implementation**

- **File.** [Individuals.tsx](../frontend/src/pages/public/Individuals/Individuals.tsx).
- **Component, props and state.** InsuranceCard receives four featured products. Page has no props/state.
- **Interactions and styling.** Follow product or quote links. Editorial hero and responsive card grid.
- **Data and API handoff.** Reads the live catalog provider and keeps categories available to individuals.

### P11 · Professionnels

**Route** `/professionnels`

Orient businesses toward brokerage advice.

- **Content and components.** Editorial hero, professional liability, premises, fleet subject to confirmation, assessment and quote CTA.
- **Responsive.** Mobile stacked summary and CTA.
- **Interactions.** Open available category or preselect business profile with profil=professionnel.
- **Fields and validation.** None.
- **API data.** GET /api/catalog?audience=BUSINESS → ProductCard[] for linked offerings.
- **States.** Shared catalog states. Keep the enquiry CTA available.

**Frontend implementation**

- **File.** [Professionals.tsx](../frontend/src/pages/public/Professionals/Professionals.tsx).
- **Component, props and state.** ContentCard takes a heading, icon and copy; MediaPlaceholder and ActionBand compose the page. No local state.
- **Interactions and styling.** Open categories or preselect professionnel. Tailwind hero columns and a four-card desktop grid stack on phones.
- **Data and API handoff.** Bundled editorial copy. Product links are enabled only for live categories available to professionals.

### P12 · À propos

**Route** `/a-propos`

Explain the agency, mission and brokerage role.

- **Content and components.** Mission, vision, values, brokerage explanation, accompaniment and approved image.
- **Responsive.** Mobile condenses to mission and brokerage role with stacked imagery/text.
- **Interactions.** Follow contact and approved quote links.
- **Fields and validation.** None.
- **API data.** None; approved static copy.
- **States.** Shared static states.

**Frontend implementation**

- **File.** [About.tsx](../frontend/src/pages/public/About/About.tsx).
- **Component, props and state.** PageHeading, MediaPlaceholder, ContentCard and ActionBand; no props/state.
- **Interactions and styling.** Follow contact/quote links. Responsive editorial split with three mission/vision/value cards.
- **Data and API handoff.** Local French draft copy. Replace with approved agency content; no endpoint required.

### P13 · Contact

**Route** `/contact`

Send a general enquiry.

- **Content and components.** Contact hero, form, agency facts and map area if approved; use FormField, Notice and StatusBanner.
- **Responsive.** Mobile uses a single column and omits subject and consent in its source. Add both to reach functional parity.
- **Interactions.** Send, retry and use the phone links. Display agency details and map only when approved.
- **Fields and validation.** Full name, phone, email, subject, message and required acknowledgement; apply ContactIn rules.
- **API data.** POST /api/contact with ContactIn and idempotency key → reference and receivedAt.
- **States.** Idle form, submitting, visible field errors or retry, then confirmation on commit.

**Frontend implementation**

- **File.** [Contact.tsx](../frontend/src/pages/public/Contact/Contact.tsx).
- **Component, props and state.** IntakeForm mode contact owns phone/text errors and verification feedback. Page passes no field props.
- **Interactions and styling.** Validate subject, message, contact and notice and verify locally. Information cards stack after the form on mobile.
- **Data and API handoff.** No record is created. Map FormData to ContactIn, keep the idempotency key on retry, then render the real receipt using api.submitContact.

### P14 · Assistance

**Route** `/assistance`

Provide the official assistance line and permit a written follow-up request.

- **Content and components.** Prominent phone card, incident guidance, support form and confirmation.
- **Responsive.** Desktop information and support sections, mobile stacked with product choice missing. Include product and privacy acknowledgement on both.
- **Interactions.** Tap official assistance line, send a request and show reference; make a new request if needed.
- **Fields and validation.** Name, phone, active product, optional contract reference, description, required acknowledgement; apply AssistanceIn; prompt to omit sensitive details.
- **API data.** GET /api/catalog → ProductCard[]; POST /api/assistance with AssistanceIn and idempotency key → reference and receivedAt.
- **States.** Load product choices or show phone fallback. Disable during POST, preserve edits on retry and display actual confirmation.

**Frontend implementation**

- **File.** [Assistance.tsx](../frontend/src/pages/public/Assistance/Assistance.tsx).
- **Component, props and state.** IntakeForm mode assistance uses the same validation state with product and contract-reference fields.
- **Interactions and styling.** Call the official number or verify a form. The blue assistance banner remains visible regardless of form state.
- **Data and API handoff.** Local category options and office data. Use api.catalog and api.submitAssistance with AssistanceIn when ready.

### P15 · FAQ

**Route** `/faq`

Answer recurring questions and route visitors to contact.

- **Content and components.** Search, six category chips plus Toutes, accessible accordions and contact action.
- **Responsive.** Stack entries, allow wrapping or scroll for chips, retain labels.
- **Interactions.** Combine local accent-insensitive search and category selection, expand/collapse, clear filters and follow contact CTA.
- **Fields and validation.** Optional search max 100 characters.
- **API data.** None; approved local FAQ dataset.
- **States.** Show all by default, matching results on filter change, no-results with reset, shared static failure recovery.

**Frontend implementation**

- **File.** [Faq.tsx](../frontend/src/pages/public/Faq/Faq.tsx).
- **Component, props and state.** PageHeading, Input, Accordion and EmptyState. Page owns search text and category.
- **Interactions and styling.** Search without accents, use category chips, open answers and reset the empty view. Chips wrap and answers stack.
- **Data and API handoff.** Local questions. Replace with approved copy; no API required.

### P16 · Mentions légales

**Route** `/mentions-legales`

Publish verified publisher, activity and hosting disclosures.

- **Content and components.** LegalArticle with editor, brokerage, hosting/IP and related policy links.
- **Responsive.** Single readable column; wrap long values/links.
- **Interactions.** Follow verified links and back/home navigation.
- **Fields and validation.** None.
- **API data.** None; approved static legal copy.
- **States.** Shared static states. Missing approval is a launch gate.

**Frontend implementation**

- **File.** [LegalNotice.tsx](../frontend/src/pages/public/LegalNotice/LegalNotice.tsx).
- **Component, props and state.** LegalArticle receives title and content; no local state.
- **Interactions and styling.** Read the marked draft and follow privacy/phone links. Single-column document panel.
- **Data and API handoff.** Draft French copy. Replace with approved publisher, hosting and legal disclosures.

### P17 · Politique de confidentialité

**Route** `/politique-de-confidentialite`

Explain data collection, purpose, retention and rights.

- **Content and components.** LegalArticle with versioned notice and approved rights contact.
- **Responsive.** Single readable column with wrapped link text.
- **Interactions.** Follow legal/cookie and approved rights contact links.
- **Fields and validation.** None.
- **API data.** None; deployed copy and publication version.
- **States.** Shared static states. Missing approval is a launch gate.

**Frontend implementation**

- **File.** [PrivacyPolicy.tsx](../frontend/src/pages/public/PrivacyPolicy/PrivacyPolicy.tsx).
- **Component, props and state.** LegalArticle receives title and content; no local state.
- **Interactions and styling.** Read the preview policy and link to cookie information. Layout uses the legal document panel.
- **Data and API handoff.** Draft French copy. Publish approved controller, rights, retention and matching notice version.

### P18 · Politique de cookies

**Route** `/politique-de-cookies`

Explain essential cookies and manage optional preferences.

- **Content and components.** Policy and preference dialog with essential/analytics controls, save/reject/accept.
- **Responsive.** Use accessible dialog in a narrow viewport and keep its actions reachable.
- **Interactions.** Open modal, restore focus after close, reject optional or save; show options only if optional tooling is actually approved and enabled.
- **Fields and validation.** Local boolean analytics preference defaults false when offered; version the saved choice.
- **API data.** None; use versioned local preference only if optional tooling launches.
- **States.** Read saved state, show saved result or storage fallback with analytics off. MVP essential-only renders policy without an active analytics control.

**Frontend implementation**

- **File.** [CookiePolicy.tsx](../frontend/src/pages/public/CookiePolicy/CookiePolicy.tsx).
- **Component, props and state.** LegalArticle and Dialog. A ref opens/closes the native modal.
- **Interactions and styling.** Display essential-only context and inspect available preferences. Dialog adapts to narrow screens.
- **Data and API handoff.** The essential staff session cookie is documented. The public preview uses no analytics cookies. Wire optional consent only if analytics is separately approved.

### P19 · Page introuvable

**Route** `*`

Recover from unknown public route.

- **Content and components.** 404 message, home, catalog and quote CTAs.
- **Responsive.** Stack actions, preserve tap targets.
- **Interactions.** Return home, open catalog or request quote.
- **Fields and validation.** None.
- **API data.** None; route fallback.
- **States.** 404 is the explicit error state. Static shell and navigation stay usable.

**Frontend implementation**

- **File.** [NotFound.tsx](../frontend/src/pages/public/NotFound/NotFound.tsx).
- **Component, props and state.** Shared ActionLink CTAs; no props/state.
- **Interactions and styling.** Recover via home, catalog or quote. Actions wrap below the short message.
- **Data and API handoff.** No backend request. Future Nginx deployment should return HTTP 404 for unknown public paths.


## Administration pages

### A01 · Connexion

**Route** `/admin/login`

Open a staff session.

- **Content and components.** AuthLayout, email/password, desktop reveal control, error banner and forgot link.
- **Responsive.** Single-column keyboard-friendly form. Mobile prototype dashboard link becomes authenticated submit.
- **Interactions.** Sign in, show/hide password and recover access.
- **Fields and validation.** Email required, password required within the server max length; generic credential errors.
- **API data.** GET /api/auth/session → Auth if already signed in; POST /api/auth/login {email,password} → Auth and cookie.
- **States.** Pending button, dashboard on success, generic 401 and retry/throttle error. No session directs to login.

**Frontend implementation**

- **File.** [Login.tsx](../frontend/src/pages/admin/Login/Login.tsx).
- **Component, props and state.** AuthLayout, Input and ErrorState. State controls password reveal, pending submit and error feedback.
- **Interactions and styling.** Send credentials to the backend, present generic login errors and continue to the requested admin page or dashboard after sign-in.
- **Data and API handoff.** Connected to api.login and api.session. The server sends the HttpOnly cookie, and the session guard protects the fixture console.

### A02 · Mot de passe oublié

**Route** `/admin/mot-de-passe-oublie`

Request recovery.

- **Content and components.** AuthLayout, email, submit and return link.
- **Responsive.** Single column with identical interaction.
- **Interactions.** Submit, see generic confirmation, return to login.
- **Fields and validation.** Professional email required and valid.
- **API data.** POST /api/auth/forgot-password {email} → accepted.
- **States.** Pending, generic success, validation/rate or network error with retry.

**Frontend implementation**

- **File.** [ForgotPassword.tsx](../frontend/src/pages/admin/ForgotPassword/ForgotPassword.tsx).
- **Component, props and state.** AuthLayout, simple email form and LocalFeedback with pending, error and accepted states.
- **Interactions and styling.** Ask for a reset link and display the generic acknowledgement. The card stays single-column on mobile.
- **Data and API handoff.** Connected to api.forgotPassword. Development delivery is verified through the local mail sink.

### A03 · Réinitialisation du mot de passe

**Route** `/admin/reinitialiser-mot-de-passe`

Set a new staff password from a recovery link.

- **Content and components.** AuthLayout, new password and confirmation, submit.
- **Responsive.** Same fields stacked with keyboard/autofill support.
- **Interactions.** Read token from URL fragment, remove fragment, enter and confirm password, then sign in.
- **Fields and validation.** Password 15–128 chars; confirmation must match locally. Valid token required.
- **API data.** POST /api/auth/reset-password {token,password} → 204.
- **States.** Invalid/missing link prompts a fresh reset. Pending and retry states. Successful reset routes to login.

**Frontend implementation**

- **File.** [ResetPassword.tsx](../frontend/src/pages/admin/ResetPassword/ResetPassword.tsx).
- **Component, props and state.** AuthLayout with password fields, mismatch, pending and server error states.
- **Interactions and styling.** Read the link secret from the fragment, remove it from the URL, confirm the password and return to login after a successful reset.
- **Data and API handoff.** Connected to api.resetPassword. The token is kept in memory and missing, expired and used links point back to recovery.

### A04 · Tableau de bord

**Route** `/admin/dashboard`

See work volume and open recent work.

- **Content and components.** AdminLayout, KPI cards, recent requests and search access. Desktop charts V2; mobile quick actions.
- **Responsive.** Stack KPIs and recent cards. Keep priority navigation available.
- **Interactions.** Open recent or filtered requests, clients, assistance or contacts. V2 adjust stats dates.
- **Fields and validation.** Optional dashboard search passes q to request list; V2 date window ordered and max 366 days.
- **API data.** GET /api/admin/dashboard → Dashboard; GET /api/admin/dashboard/trends with query from and to → Trends in V2.
- **States.** Skeletons, zero counts, no recent work, section retry. Never use demo metrics.

**Frontend implementation**

- **File.** [Dashboard.tsx](../frontend/src/pages/admin/Dashboard/Dashboard.tsx).
- **Component, props and state.** AdminHeading and RequestList; reads the operational dashboard endpoint and renders counts and charts from database aggregates. Local search state feeds a request-list query.
- **Interactions and styling.** Open filtered actions and recent dossiers. KPI grid, simple bars and responsive table/cards.
- **Data and API handoff.** Live request counts, categories, recent records and activity. Issued quote metrics display as unavailable.

### A05 · Demandes de devis

**Route** `/admin/demandes`

Find intake records.

- **Content and components.** Search, status/product/date filters, pageable desktop table and mobile cards.
- **Responsive.** Keep filters reachable even where mobile prototype only shows search.
- **Interactions.** Search by name/reference/phone, filter, paginate and open details.
- **Fields and validation.** q 2–100; filter enums, ordered dates and valid pagination.
- **API data.** GET /api/admin/quote-requests with list query → RequestRow page.
- **States.** Shared staff list states.

**Frontend implementation**

- **File.** [QuoteRequests.tsx](../frontend/src/pages/admin/QuoteRequests/QuoteRequests.tsx).
- **Component, props and state.** Inputs, Select, RequestList. Search, filters and page are held in the URL. The service fetches the filtered page and its total.
- **Interactions and styling.** Search, combine filters, validate date order, paginate and open details. Desktop table and smaller record cards.
- **Data and API handoff.** Live staff-only requests, with server pagination and loading, empty and error states.

### A06 · Détails d’une demande

**Route** `/admin/demandes/:id`

Review and process a single intake record.

- **Content and components.** Request summary, contact and needs, status/assignment card, client picker and notes. Create issued quote shortcut V2.
- **Responsive.** Stack sections. Desktop controls for assignee, notes and all valid states need mobile parity.
- **Interactions.** Call/email, assign, update status, append note, link client and open V2 quote creation.
- **Fields and validation.** Valid UUIDs, current version, permitted status transition, active assignee/client, note 1–1000.
- **API data.** GET and PATCH /api/admin/quote-requests/:id → RequestDetail; POST its notes subroute {version,body} → RequestDetail; GET staff options and clients → pages; V2 quote creation via A11.
- **States.** Shared staff detail states, success announcement per change and stale edit recovery.

**Frontend implementation**

- **File.** [QuoteRequestDetail.tsx](../frontend/src/pages/admin/QuoteRequestDetail/QuoteRequestDetail.tsx).
- **Component, props and state.** Reads :id, passes record to RequestEditor. The editor holds feedback and submits the current record version to the server. Successful responses supply the new record.
- **Interactions and styling.** Update permitted state, assign advisor, link client and append note. Cards stack on mobile.
- **Data and API handoff.** Live request, staff and client selectors. Version-aware updates and notes persist in PostgreSQL. Conflicts offer a reload.

### A07 · Clients

**Route** `/admin/clients`

Find an existing client or start a profile.

- **Content and components.** Search, profile filter, client table/cards, add action and V2 active contract count.
- **Responsive.** Mobile compact cards and reachable filters/action.
- **Interactions.** Search, open client profile, start creation.
- **Fields and validation.** q 2–100, profile/archived filters and valid page.
- **API data.** GET /api/admin/clients → ClientRow page.
- **States.** Shared staff list states. Empty includes add action.

**Frontend implementation**

- **File.** [Clients.tsx](../frontend/src/pages/admin/Clients/Clients.tsx).
- **Component, props and state.** AdminHeading, filter inputs and RecordList; page owns search, profile and archive filters.
- **Interactions and styling.** Search/filter, switch archive visibility, open profile and add client. Table/card layout follows viewport.
- **Data and API handoff.** Fictional clients. Read the paginated GET clients API and keep visibility permission checks on server.

### A08 · Profil client

**Route** `/admin/clients/:id`

Review contact and case history.

- **Content and components.** Contact summary, linked requests, edit/archive actions and V2 quote and contract history.
- **Responsive.** Stack contact/history. Mobile reference omits detailed quote history.
- **Interactions.** Open contact action, edit or archive if Admin, open linked records and lists.
- **Fields and validation.** Archive sends version; block open linked requests and active policies.
- **API data.** GET /api/admin/clients/:id → ClientDetail; POST its archive subroute {version} → Client; list by clientId for extended V2 histories.
- **States.** Shared detail states. Show a clear empty history and confirm archive only after committed response.

**Frontend implementation**

- **File.** [ClientProfile.tsx](../frontend/src/pages/admin/ClientProfile/ClientProfile.tsx).
- **Component, props and state.** Reads :id, uses Facts, RequestList, related-record cards and archive Dialog; a ref manages modal.
- **Interactions and styling.** View links/history and confirm allowed archive locally. Side-by-side histories stack.
- **Data and API handoff.** Related fixtures. Fetch client detail and require Admin permission/current version for archive.

### A09 · Ajouter / modifier un client

**Route** `/admin/clients/nouveau` · `/admin/clients/:id/modifier`

Maintain an authorized client record.

- **Content and components.** Client form and back actions. Omit the source CIN/ICE field by minimization decision.
- **Responsive.** Mobile form retains optional email and notes via existing field styles.
- **Interactions.** Check possible duplicates, save, cancel, then return to profile.
- **Fields and validation.** ClientIn: profile, display name and phone required; email, city and notes optional. Edit requires version.
- **API data.** GET /api/admin/clients for duplicate hints; GET /api/admin/clients/:id → ClientDetail; POST /api/admin/clients or PATCH /api/admin/clients/:id → Client.
- **States.** Empty create or edit skeleton, pending, field errors, saved profile or stale revision.

**Frontend implementation**

- **File.** [ClientForm.tsx](../frontend/src/pages/admin/ClientForm/ClientForm.tsx).
- **Component, props and state.** Create/edit wrapper reads :id, Editor receives optional existing record. Native form fields plus controlled phone and error.
- **Interactions and styling.** Validate phone, show duplicate hint, save to shared demo and open resulting profile. Two-column fields stack.
- **Data and API handoff.** Fictional clients and in-memory drafts. Use ClientIn for create, PATCH with version for edit and real duplicate hint lookup.

### A10 · Devis

**Route** `/admin/devis`

Browse actual quote records in V2.

- **Content and components.** Quote table, reference, client, product, MAD amount, status, add/view actions.
- **Responsive.** Use stacked cards. Export shows a Devis & Contrats heading, but contracts have a separate mobile screen.
- **Interactions.** Filter/paginate, open quote, start a draft.
- **Fields and validation.** Optional enum status, UUID client/request filters and page.
- **API data.** GET /api/admin/quotes → QuoteRow page.
- **States.** Shared staff list states.

**Frontend implementation**

- **File.** [Quotes.tsx](../frontend/src/pages/admin/Quotes/Quotes.tsx).
- **Component, props and state.** AdminHeading, Input, Select and RecordList. Search/status in component, client/request scope from query.
- **Interactions and styling.** Filter and open an existing quote or start draft. Responsive table/cards.
- **Data and API handoff.** Fictional quotes/prices. Connect V2 GET quotes with server filtering/pagination.

### A11 · Création de devis

**Route** `/admin/devis/nouveau`

Draft and optionally issue an approved quote in V2.

- **Content and components.** Client, product and partner selectors, premium, conditions and draft/issue actions.
- **Responsive.** Missing mobile prototype. Adapt existing form primitives and review layout before implementation.
- **Interactions.** Preselect linked request, save draft, authorized Admin can confirm issuance after draft creation.
- **Fields and validation.** QuoteIn; require active client and partner, positive MAD, conditions limit and compatible request. Issue requires version.
- **API data.** GET /api/admin/clients, /api/admin/catalog and /api/admin/partners → selector data. POST /api/admin/quotes → Quote; POST its issue subroute → 202 Quote.
- **States.** Load selectors, unavailable eligibility state, save draft success, issuance shows queued PDF, API errors preserve input.

**Frontend implementation**

- **File.** [QuoteCreate.tsx](../frontend/src/pages/admin/QuoteCreate/QuoteCreate.tsx).
- **Component, props and state.** Reads demande param; QuoteEditor receives optional linked request and holds amount error.
- **Interactions and styling.** Prefill linked client/category, validate decimal and save a local draft. Uses stacked fields for missing mobile reference.
- **Data and API handoff.** Fictional clients/requests; no seeded partners. Wire V2 client/catalog/partner selectors, require verified partner and POST draft.

### A12 · Détails d’un devis

**Route** `/admin/devis/:id`

Review quote, record decision, download PDF or start a contract in V2.

- **Content and components.** Reference and status, client/product/carrier/amount, terms, PDF and contract CTA. Proposed draft edit uses A11 fields inline.
- **Responsive.** Missing mobile prototype. Review stacked detail cards and accessible action placement.
- **Interactions.** Approve a draft or record accepted/declined if Admin, download ready PDF, continue accepted quote to A14.
- **Fields and validation.** UUID, version on writes, draft constraints and state transition; downstream contract meets ContractIn.
- **API data.** GET/PATCH /api/admin/quotes/:id → Quote, POST its issue/decision subroutes → Quote, GET document download → PDF. Contract creation occurs through A14.
- **States.** Shared detail states, queued/ready/failed PDF status, stale handling and download retry.

**Frontend implementation**

- **File.** [QuoteDetail.tsx](../frontend/src/pages/admin/QuoteDetail/QuoteDetail.tsx).
- **Component, props and state.** Reads :id; QuoteProfile receives record; local editing/feedback plus issue Dialog. Reuses QuoteEditor.
- **Interactions and styling.** Inspect terms, edit draft, simulate issue/decision, open contract. Mobile facts/actions stack; PDF is disabled.
- **Data and API handoff.** Fictional quote. Wire V2 read/update/issue/decision APIs, allow readiness-gated document download with server permissions.

### A13 · Contrats

**Route** `/admin/contrats`

Find and track policies in V2.

- **Content and components.** Reference, client, product/carrier, expiry/status and navigate to details/new.
- **Responsive.** Use mobile policy cards and accessible filters.
- **Interactions.** Filter expiry/status, paginate, open a policy or create draft.
- **Fields and validation.** Valid query dates, status/client filter and page.
- **API data.** GET /api/admin/contracts → ContractRow page.
- **States.** Shared list states. Renewal badges derive from expiry if active.

**Frontend implementation**

- **File.** [Contracts.tsx](../frontend/src/pages/admin/Contracts/Contracts.tsx).
- **Component, props and state.** Filter controls and RecordList. Search, status and expiry range in state, client scope via URL.
- **Interactions and styling.** Filter by name/date/status and open draft/detail. Cards replace dense table on smaller widths.
- **Data and API handoff.** Fictional contracts and client associations. Use V2 GET contracts with validated filters and pagination.

### A14 · Création / détails d’un contrat

**Route** `/admin/contrats/nouveau` · `/admin/contrats/:id`

Create a draft and view/maintain a policy in V2.

- **Content and components.** Policy reference, client, product, partner, term dates, state, save and document areas.
- **Responsive.** Existing versions use similar fields. Stack linked selectors and separate state actions from editable draft fields.
- **Interactions.** Open with accepted quote preselection, save draft, activate or cancel if Admin, download PDF on readiness.
- **Fields and validation.** ContractIn, version, valid date order and unique carrier/policy. Source quote must be accepted and match other relationships.
- **API data.** GET /api/admin/clients, /api/admin/catalog, /api/admin/partners and optional source quote; GET/PATCH /api/admin/contracts/:id or POST /api/admin/contracts → Contract. Status subroute → Contract. Document download → PDF.
- **States.** New/edit/detail skeletons and no eligible choices, saved/active result, PDF status, field or stale conflict with retry.

**Frontend implementation**

- **File.** [ContractForm.tsx](../frontend/src/pages/admin/ContractForm/ContractForm.tsx).
- **Component, props and state.** Reads :id or devis preselection; ContractEditor receives record/accepted quote; validation and status dialog local.
- **Interactions and styling.** Validate policy and term, edit draft, simulate activation/cancel. Detail and editor stack on mobile.
- **Data and API handoff.** Fictional policies and quotes. Use V2 contract CRUD and lifecycle, server checks for source quote, carrier, policy uniqueness, PDF and renewal readiness.

### A15 · Demandes d’assistance

**Route** `/admin/assistance`

Follow up support cases. Basic review in MVP, dedicated inbox styling in V2.

- **Content and components.** Reference, name, category, contract text, priority, and status. Add accessible selected-record detail in the same route using shared case panel.
- **Responsive.** Shared mobile reference with A18. Route still selects assistance data and may share a switcher on mobile.
- **Interactions.** Filter by status, priority or exact reference, view selected case, call, progress or resolve.
- **Fields and validation.** Enums, UUID, optional exact reference, version and valid transitions.
- **API data.** GET /api/admin/assistance → AssistanceRow page; GET/PATCH /api/admin/assistance/:id → AssistanceCase.
- **States.** Shared list and detail states. After updating use server status and announce.

**Frontend implementation**

- **File.** [AssistanceInbox.tsx](../frontend/src/pages/admin/AssistanceInbox/AssistanceInbox.tsx).
- **Component, props and state.** SupportInbox receives assistance kind and owns reference/status/priority filters; CaseDetails receives selected row.
- **Interactions and styling.** Filter/open case and update priority or status in memory. Nav link switches to Messages on narrower screen.
- **Data and API handoff.** Fictional cases. Wire case list/detail/PATCH with version checks and role authorization.

### A16 · Catalogue des assurances

**Route** `/admin/assurances`

Maintain the six fixed product pages in V2.

- **Content and components.** Six product cards and edit/visibility controls. Add available only for an unseeded reserved slot.
- **Responsive.** Mobile stacked cards with matching control permissions.
- **Interactions.** Edit French product copy, associated product links, order and visibility. Review public preview before publishing.
- **Fields and validation.** CatalogWrite and version on update, approved image keys, unique reserved slug and valid related products.
- **API data.** GET /api/admin/catalog → CatalogItem[]. GET /api/admin/catalog/:id → CatalogItem. POST /api/admin/catalog with CatalogWrite and slug → CatalogItem. PATCH /api/admin/catalog/:id → CatalogItem.
- **States.** Shared list/form states, empty fallback, publish confirmation and conflict recovery.

**Frontend implementation**

- **File.** [InsuranceManagement.tsx](../frontend/src/pages/admin/InsuranceManagement/InsuranceManagement.tsx).
- **Component, props and state.** Card grid and edit Dialog; state holds selected product, error and feedback.
- **Interactions and styling.** Edit French descriptions and indicative coverages, publish, unpublish or deactivate. Advisors have read-only access. Cards stack from three desktop columns to one on mobile.
- **Data and API handoff.** Live catalog list, detail and versioned writes. The six seeded rows are drafts until published by an admin. See [Catalog implementation](18-INSURANCE-CATALOG-IMPLEMENTATION.md).

### A17 · Partenaires

**Route** `/admin/partenaires`

Manage verified insurer records in V2.

- **Content and components.** Carrier cards, add/edit controls, status, approved logo if available.
- **Responsive.** Stack cards and reuse the shared edit form.
- **Interactions.** Create, edit or deactivate. Preserve historical links.
- **Fields and validation.** PartnerIn, case-insensitive unique name and approved logo/HTTPS website when supplied.
- **API data.** GET /api/admin/partners → Partner page, POST or PATCH carrier → Partner.
- **States.** Shared list/form states. Show empty carrier list and disable issue where no eligible carrier exists.

**Frontend implementation**

- **File.** [Partners.tsx](../frontend/src/pages/admin/Partners/Partners.tsx).
- **Component, props and state.** Partner editor Dialog and card/empty state; local editing, validation and feedback.
- **Interactions and styling.** Create/edit/deactivate a fictitious example. Grid stacks on mobile. Initial list is empty.
- **Data and API handoff.** No seeded companies. Wire V2 GET/POST/PATCH with uniqueness/version and approved website/logo inputs.

### A18 · Messages reçus

**Route** `/admin/messages`

Review and close general enquiries. Basic access in MVP, dedicated inbox styling in V2.

- **Content and components.** Message list, selected message detail, phone/email and read/processed actions.
- **Responsive.** Shares the assistance/messages reference. Keep correct active section and readable content.
- **Interactions.** Filter by status or reference, open, mark read/processed and use authorized contact actions.
- **Fields and validation.** Valid status, UUID, version and transition.
- **API data.** GET /api/admin/messages → MessageRow page; GET/PATCH /api/admin/messages/:id → Message.
- **States.** Shared list and detail states. Confirm changes only on commit.

**Frontend implementation**

- **File.** [Messages.tsx](../frontend/src/pages/admin/Messages/Messages.tsx).
- **Component, props and state.** SupportInbox receives message kind; reference/status filters, URL selection and CaseDetails.
- **Interactions and styling.** Open/read or mark processed, switch to assistance. Shares the mobile pattern from Stitch.
- **Data and API handoff.** Fictional messages. Use message list/detail/PATCH with versions and access checks.

### A19 · Paramètres

**Route** `/admin/parametres`

Maintain confirmed agency details in V2.

- **Content and components.** Office and assistance phones, agency name, optional official email, address and hours. Shared fields and status banner.
- **Responsive.** Stack all fields, including hours which are absent in the mobile export.
- **Interactions.** Admin views locked identity and updates approved optional fields.
- **Fields and validation.** Email syntax, address/hours length, optional nullable fields and required version.
- **API data.** GET/PATCH /api/admin/settings → Settings.
- **States.** Shared detail/form states. Render unconfigured values as blank, show saved outcome and preserve edits on failure.

**Frontend implementation**

- **File.** [Settings.tsx](../frontend/src/pages/admin/Settings/Settings.tsx).
- **Component, props and state.** Sectioned Input/Textarea form. Uses official values in company configuration; saved flag in component.
- **Interactions and styling.** View locked identity and phones, edit demo contact fields and see local acknowledgement.
- **Data and API handoff.** Optional fields initially blank. Wire Admin-only V2 GET/PATCH settings when official facts are approved.
