# 15 — Frontend and backend implementation status

The local React frontend covers 19 public and 19 administration page types. Two admin pages have separate create and detail/edit routes, for 40 concrete page views in the browser test matrix, including a public unknown-path example. Quote confirmation is the final UI state of /devis. The admin root sends signed-in staff to the dashboard and visitors to login. Unknown admin paths show an authenticated fallback. The original Stitch archive and design files are preserved.

## Resume checkpoint

At the frontend baseline, the routes, public forms, admin demo, reusable components and API preparation were already in place. The resumed work repeated browser verification, reviewed the reference layouts and finished the handoff documentation. Two issues were confirmed and fixed. The catalog now uses the compact Stitch mobile heading and puts the audience selector above the cards in the introduction. Browser-tab titles now follow each route’s heading, with the navigation focus effect running inside the route loading boundary.

The frontend baseline is complete. Staff authentication, the catalog, quote intake, customer CRM, contact and assistance now use the backend. Production release depends on approved imagery and the standalone brand asset, approved French company and legal content, and production settings.

## Development milestones

| Phase | Result |
| --- | --- |
| A · Foundation | React/Vite/TypeScript, ESLint, Tailwind, React Router, locally bundled Inter and Lucide. Public, auth and admin layouts with shared fields, buttons, badges, breadcrumbs, loading/empty/error states and native dialogs. Foundation build and lint passed before implementing public pages. |
| B · Public | Six details share one template, catalog and FAQ filters run locally, quote flow validates four steps on each device, and contact and assistance validate locally. Confirmation states describe the preview. |
| C · Admin | Sign-in and recovery interfaces, fixture dashboard and lists, editable demo records and shared mobile patterns. The sidebar collapses on desktop and opens a navigation dialog at narrower widths. |
| D · Assets | Audited 73 original prototypes, two Markdown references and the brand board. Probed nine distinct asset URLs across 30 image references. HEAD returned HTTP 200 with text/html for all nine, so image availability could not be confirmed. No photography was downloaded or embedded. |
| E · API preparation | Read 50 endpoint contracts. Added typed catalog, intake, auth and operational DTOs, an error type and a small same-origin client for catalog/intake/auth. UI remains independent of unavailable services. |

## Frontend baseline verification

- Dependency installation, TypeScript, ESLint and Vite production build passed. npm reported that the pinned ESLint 9 release is deprecated. It remains compatible with the current configuration and plugins.
- Before authentication integration, headless Chrome with Playwright exercised the frontend production build at **390, 768, 1024 and 1440 px**. At each width, 40 route views and six admin redirect or fallback cases rendered with a single main heading, a matching tab title and no page-level horizontal overflow. The full four-step quote flow and public and admin navigation passed at all four widths, including menu focus, filtering and pagination.
- The extended browser run also covered public form validation, FAQ, cookie preferences, login and recovery previews, staff record edits, quote and contract simulations, and local settings. The demo flows produced zero uncaught browser errors and zero API requests.
- Compared the matching Stitch HTML sources and rendered ten representative references in Chrome, covering home, catalog, quote wizard, dashboard and the two desktop quote admin screens. With remote photos blocked, reviewed hierarchy, responsive structure and spacing and refined the quote panel, utility bar and dashboard. Final photo cropping and logo parity remain pending approved assets.

**How to read the table.** Every row is implemented. **4 widths** in the baseline table means direct route rendering and no page-level horizontal overflow at the four requested widths. A named interaction means it was also exercised in a browser. Source paths, props, state, styling and endpoint handoffs are documented in [03 Frontend](03-FRONTEND.md).

| ID | Page / route | Implementation | Responsive | Browser checks | API / data | Known issue or release dependency |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | Accueil · `/` | Implemented | 4 widths | Mobile menu and catalog navigation | Live published catalog | Approved photos, logo, partner content |
| P02 | Nos assurances · `/assurances` | Implemented | 4 widths | Audience filter and product navigation; mobile header compared with Stitch | Live published catalog | Approved category imagery |
| P03 | Assurance automobile · `/assurances/automobile` | Implemented | 4 widths | Product → preselected quote | Live published detail | Approved visual and product copy |
| P04 | Assurance habitation · `/assurances/habitation` | Implemented | 4 widths | Route smoke | Live published detail | Approved visual and product copy |
| P05 | Assurance santé · `/assurances/sante` | Implemented | 4 widths | Route smoke | Live published detail | Approved visual and product copy |
| P06 | Assurance voyage · `/assurances/voyage` | Implemented | 4 widths | Route smoke | Live published detail | Approved visual and product copy |
| P07 | Assurance professionnelle · `/assurances/professionnelle` | Implemented | 4 widths | Route smoke | Live published detail | Approved visual and product copy |
| P08 | Responsabilité civile · `/assurances/responsabilite-civile` | Implemented | 4 widths | Legacy rc preselection | Live published detail | Approved visual and product copy |
| P09 | Demande de devis · `/devis` | Implemented | 4 widths | Steps, back, phone, consent, review and reset | Live catalog, notice and quote receipt | Approved privacy wording and deployment configuration |
| P10 | Particuliers · `/particuliers` | Implemented | 4 widths | Route smoke | Live published individual categories | Approved imagery and content |
| P11 | Professionnels · `/professionnels` | Implemented | 4 widths | Route smoke | Editorial content with live availability for links | Approved imagery and business copy |
| P12 | À propos · `/a-propos` | Implemented | 4 widths | Route smoke | Bundled content; no request | Approved imagery and agency copy |
| P13 | Contact · `/contact` | Implemented | 4 widths | Real submission, notice and persisted receipt | Live contact intake | Approved contact notice and agency details |
| P14 | Assistance · `/assistance` | Implemented | 4 widths | Live category selection and persisted receipt | Live assistance intake | Approved notice wording and production notifications |
| P15 | FAQ · `/faq` | Implemented | 4 widths | Search and accordion | Bundled content; no request | Final FAQ copy approval |
| P16 | Mentions légales · `/mentions-legales` | Implemented | 4 widths | Route smoke | Bundled content; no request | Publisher/legal/hosting details pending |
| P17 | Politique de confidentialité · `/politique-de-confidentialite` | Implemented | 4 widths | Route smoke | Bundled content; no request | Controller, notice version and retention pending |
| P18 | Politique de cookies · `/politique-de-cookies` | Implemented | 4 widths | Modal and Escape | Bundled content; no request | Essential-only preview |
| P19 | Page introuvable · `*` | Implemented | 4 widths | Unknown path layout | Bundled content; no request | Preview has SPA HTTP 200; production requires edge 404 |
| A01 | Connexion · `/admin/login` | Implemented | 4 widths | Valid and invalid login, guarded return path and refresh | Connected auth session | Approved production deployment settings |
| A02 | Mot de passe oublié · `/admin/mot-de-passe-oublie` | Implemented | 4 widths | Generic acknowledgement and Mailpit capture | Connected recovery endpoint | Approved SMTP provider pending |
| A03 | Réinitialisation du mot de passe · `/admin/reinitialiser-mot-de-passe` | Implemented | 4 widths | Fragment cleanup, password validation and reset | Connected reset endpoint | Approved SMTP provider pending |
| A04 | Tableau de bord · `/admin/dashboard` | Implemented | 4 widths | Quote and support workflow, live metric links | Live quote, CRM, contact and assistance metrics | Issued quote and policy metrics unavailable |
| A05 | Demandes de devis · `/admin/demandes` | Implemented | 4 widths | Search and pagination | Live staff requests and server pagination | Date, status, product and assignee filters |
| A06 | Détails d’une demande · `/admin/demandes/:id` | Implemented | 4 widths | Update status, assign and add note | Live request, associated client, assignments, status and notes | Sending a quote requires a later delivery workflow |
| A07 | Clients · `/admin/clients` | Implemented | 4 widths | Search by request reference, open profile and create | Live CRM search, filters and server pagination | Full record merge deferred |
| A08 | Profil client · `/admin/clients/:id` | Implemented | 4 widths | Verification, linked requests and refresh | Live profile, verification, relationships and history | Issued quote and contract histories deferred |
| A09 | Ajouter / modifier un client · `/admin/clients/nouveau` · `/admin/clients/:id/modifier` | Implemented | 4 widths | Manual creation, edit and verification | Live create/update and duplicate review | Explicit confirmation for a distinct matching record |
| A10 | Devis · `/admin/devis` | Implemented | 4 widths | Route smoke | Fictional data; endpoint pending | V2 quotes are illustrative |
| A11 | Création de devis · `/admin/devis/nouveau` | Implemented | 4 widths | Preselection, amount validation and draft creation | Fictional data; endpoint pending | Mobile adaptation; demo carrier may be empty |
| A12 | Détails d’un devis · `/admin/devis/:id` | Implemented | 4 widths | Simulated issuance, decision and contract navigation | Fictional data; endpoint pending | Mobile adaptation; downloads disabled |
| A13 | Contrats · `/admin/contrats` | Implemented | 4 widths | Route smoke | Fictional data; endpoint pending | V2 policies are illustrative |
| A14 | Création / détails d’un contrat · `/admin/contrats/nouveau` · `/admin/contrats/:id` | Implemented | 4 widths | Date validation, draft and simulated activation | Fictional data; endpoint pending | No actual policies, PDFs or reminders |
| A15 | Demandes d’assistance · `/admin/assistance` | Implemented | 4 widths | Assign, change priority and status, link and add note | Live assistance inbox and verified links | Uses existing contracts only |
| A16 | Catalogue des assurances · `/admin/assurances` | Implemented | 4 widths | Edit summary and visibility modal | Live staff catalog and Admin writes | Admin publishing requires approved product content |
| A17 | Partenaires · `/admin/partenaires` | Implemented | 4 widths | Add example in modal | Fictional data; endpoint pending | No registered insurer, logos or publishing |
| A18 | Messages reçus · `/admin/messages` | Implemented | 4 widths | Read, process and refresh | Live contact inbox and archive | Reply dispatch and internal message notes are outside this phase |
| A19 | Paramètres · `/admin/parametres` | Implemented | 4 widths | Local update, locked main phone | Fictional data; endpoint pending | Official details require confirmation |

## Backend phase B1–B3

- **Completed.** Local Compose PostgreSQL, all 18 table definitions, versioned migration and non-publishing category seed. Express has liveness/readiness and server-side authentication, recovery, password change and role checks. The bootstrap command queues a one-time admin setup link.
- **Frontend.** Real forms, HttpOnly cookie session restoration, admin route guards, session expiry handling, logout and ADMIN-only settings access are connected. The demo entry shortcut is removed. Business fixtures remain separate from authentication data.
- **Verified.** The production build worked through the Vite proxy in headless Chrome. Twenty protected entries redirected before sign-in. Secure provisioning with local SMTP capture, invalid and valid login, route restoration after refresh, expiry, recovery, password change, role checks and logout passed in an isolated database.
- **B1–B3 handoff.** Business endpoints and production settings were pending at this checkpoint. See [16 Backend implementation](16-BACKEND-IMPLEMENTATION.md) and [17 Backend beginner guide](17-BACKEND-BEGINNER-GUIDE.md).

## Business phases B4–B5

- **Catalog.** Public lists and all six details use published, active rows from PostgreSQL. The staff catalog supports read-only advisor access and versioned Admin edits. Seeded categories remain unpublished. See [18 Live insurance catalog](18-INSURANCE-CATALOG-IMPLEMENTATION.md).
- **Quote workflow.** The anonymous four-step wizard validates and sends the current privacy acknowledgement, then shows the persisted reference. Each fresh submission creates a linked provisional customer. Staff can review, assign, relink, add notes and update permitted statuses. The dashboard shows live request metrics. See [19 Quote request implementation](19-QUOTE-REQUEST-IMPLEMENTATION.md).
- **Migration.** `20261127010000_catalog_quote_intake` adds `insurance_products.is_active` and `clients.intake_provisional`. A database constraint requires published products to be active. The original foundation migration and seed are intact.
- **Automated verification.** Frontend and backend TypeScript, ESLint and production builds passed. Prisma validation, migration deployment, migration status and schema comparison passed. All four unit tests and all 19 PostgreSQL integration tests passed, including 10 previous tests and nine new business tests. The suites cover permissions, CSRF, input checks, rate limiting, visibility, idempotency, rollback, customer association, filtering, status changes, audit records and SMTP retry.
- **Browser verification.** The production build and compiled API completed the full real submission and staff workflow at **390, 768, 1024 and 1440 px**. Staff published a test category at each width, visitors submitted the four steps, and staff opened the saved request from the dashboard and changed its status. Refresh preserved the change. Anonymous request and customer access returned 401. All six published detail routes passed the browser checks at each width, and the tested views had no page-level horizontal overflow. A follow-up browser check exercised request list search, private note persistence and product deactivation. At 390 px the original response was dropped after commit and retry recovered the same reference.
- **Local email.** Mailpit captured four test customer acknowledgements and four internal notifications, exactly two jobs per accepted request. Production delivery is pending approved SMTP settings and recipients.
- **B4–B5 handoff.** Contact, assistance and full CRM were pending at this checkpoint. Issued quotes, contracts, documents, partners and settings remained demonstrations. The dashboard marks issued quote counts as unavailable. Production requires approved product descriptions, visual assets, the privacy notice and deployment settings.

## Business phases B6–B7

- **CRM.** Staff can search, filter and paginate customers, create or edit verified profiles, verify provisional profiles, review possible duplicates and view linked quote requests, assistance cases and activity. Only administrators can archive a customer, and open work or an active contract blocks archival. Advanced consolidation remains deferred. [Customer CRM guide](20-CUSTOMER-CRM-IMPLEMENTATION.md)
- **Contact and assistance.** The public forms use approved versioned notices and return committed, idempotent references. The two staff inboxes persist status changes. Staff can archive processed messages and assign assistance cases, set priority, append notes and attach verified customer and eligible contract links. The dashboard adds customer, contact and assistance metrics and activity. [Contact and assistance guide](21-CONTACT-ASSISTANCE-IMPLEMENTATION.md)
- **Migration.** `20261127020000_crm_support` keeps the 18 original tables. It adds nullable assistance relationships, one-parent assistance note support and a message archive timestamp. The upgrade preserved a pre-existing quote/client relationship, quote note, assistance case and contact message. Prisma validation, deployment, status and schema comparison were checked in isolated databases.
- **Automated checks.** Frontend and backend TypeScript, ESLint and production builds passed. Four unit tests and 27 PostgreSQL integration tests passed, including 19 authentication/catalog/quote regression tests and eight CRM/support tests.
- **Browser workflows.** Chrome exercised catalog publication, quote intake, CRM creation/edit/verification and linked records, public contact submission and staff processing, assistance submission and staff assignment/processing/notes, and dashboard counts at **390, 768, 1024 and 1440 px**. Anonymous requests for each private record type returned 401. At 390 px a lost contact response replayed the same committed reference. A synthetic existing contract was linked at 390 px after staff verification. Tested business pages had no page-level horizontal overflow.
- **Final route verification.** Chrome passed 41 page views and 20 signed-out admin redirects at each of **390, 768, 1024 and 1440 px**. The matrix includes all six published product details, login and recovery screens, protected and fallback routes, and public and staff navigation. Each tested view had one matching main heading and tab title without horizontal overflow. The browser reported no uncaught exceptions.
- **Targeted security and state checks.** The resumed browser run confirmed explicit duplicate handling, a 120-character customer name at 390 px, Admin customer archive, message read/unread/processed transitions and archive filtering after refresh. It also confirmed anonymous record reads returned 401, staff writes without CSRF returned 403, an advisor could not access Admin-only settings, and submitted markup rendered as text. The session cookie was HttpOnly and SameSite=Lax over local HTTP. Integration tests additionally verified production cookie attributes and protected business transitions.
- **Local mail.** Mailpit captured four contact acknowledgements, four contact alerts and four assistance alerts, plus eight quote regression emails. The replay generated no duplicate mail. Assistance provides on-screen acknowledgement because the form collects no email.
- **Remaining.** Issued quotes, contracts, payments, partners, settings and advanced documents are outside the current implementation. Approved form notices, SMTP configuration and recipients are needed before production intake. The Stitch ZIP passed its integrity check and matched the recorded SHA-256 `57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583`.

## Differences from the Stitch prototypes

- **Brand and photography.** The ZIP’s PNG contains the brand board, and the HTML contains inline prototype monograms. The standalone approved logo/lockup was unavailable, so the app uses a typographic brand-name placeholder. Neutral themed media regions preserve layout space. The homepage omits the unverified carrier block. No partner names, contact details, registration identifiers, premiums or promises are presented as verified business facts.
- **Intake.** The export’s mobile quote page only contains the start of a wizard. All four steps and the input review use the same controlled form at every width. Optional category selectors collect general context and fit within the documented needs text. Desktop and mobile contact and assistance use the same required fields. The live forms display committed references.
- **Admin design.** A11 and A12 adapt the desktop design to stacked mobile form/detail sections. The merged assistance/messages mobile reference uses a shared layout, two distinct routes and a switch link. Dashboard metrics use committed records. The banner identifies the remaining fixture-backed modules, including issued quotes, contracts, partners and settings.
- **Supporting behavior.** Legal content is bundled. The preferences dialog explains the essential-only posture. Catalog edits persist through the API. Settings edits remain local to the demonstration. Client forms exclude CIN/ICE and medical information. Official phones are read-only.
- **Release.** Configure the approved SMTP relay and production controls before accepting real requests. Complete the proposed integrations for remaining demonstration modules before using them with live data. Obtain approved assets, French policy copy and company details before publication.

## Files and local commands

- Added [frontend/README.md](../frontend/README.md), the package manifest and lockfile, Vite/TypeScript/ESLint configuration, app entry, styling system, layouts and 38 page folders.
- Added shared components, local reference/fixture data, centralized company/navigation settings, form utilities, initial API types and service functions.
- Added this status sheet and appended implementation notes to the 38 page specifications in [03 Frontend](03-FRONTEND.md).
- The resumed work updated [App.tsx](../frontend/src/App.tsx), [InsuranceCatalog.tsx](../frontend/src/pages/public/InsuranceCatalog/InsuranceCatalog.tsx) and the two frontend documentation files. The package manifest and lockfile were unchanged. The Stitch ZIP passed its integrity check and matched the original SHA-256 checksum.

```sh
cd frontend
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```
