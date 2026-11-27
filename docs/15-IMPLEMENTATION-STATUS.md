# 15 — Frontend implementation status

The local React frontend covers 19 public and 19 administration page types. Two admin pages have separate create and detail/edit routes, for 40 concrete page views in the browser test matrix, including a public unknown-path example. Quote confirmation is the final UI state of /devis. The admin root redirects to login and unknown admin paths show an admin fallback. The original Stitch archive and design files are preserved.

## Resume checkpoint

The routes, public forms, admin demo, reusable components and API preparation were already in place. The resumed work repeated browser verification, reviewed the reference layouts and finished the handoff documentation. Two issues were confirmed and fixed. The catalog now uses the compact Stitch mobile heading and puts the audience selector above the cards in the introduction. Browser-tab titles now follow each route’s heading, with the navigation focus effect running inside the route loading boundary.

The frontend demo is complete. Production work still depends on approved imagery and the standalone brand asset, approved French company and legal content, and backend authentication, submissions and persistence.

## Development milestones

| Phase | Result |
| --- | --- |
| A · Foundation | React/Vite/TypeScript, ESLint, Tailwind, React Router, locally bundled Inter and Lucide. Public, auth and admin layouts with shared fields, buttons, badges, breadcrumbs, loading/empty/error states and native dialogs. Foundation build and lint passed before implementing public pages. |
| B · Public | Six details share one template, catalog and FAQ filters run locally, quote flow validates four steps on each device, and contact and assistance validate locally. Confirmation states describe the preview. |
| C · Admin | Sign-in and recovery interfaces, fixture dashboard and lists, editable demo records and shared mobile patterns. The sidebar collapses on desktop and opens a navigation dialog at narrower widths. |
| D · Assets | Audited 73 original prototypes, two Markdown references and the brand board. Probed nine distinct asset URLs across 30 image references. HEAD returned HTTP 200 with text/html for all nine, so image availability could not be confirmed. No photography was downloaded or embedded. |
| E · API preparation | Read 50 endpoint contracts. Added typed catalog, intake, auth and operational DTOs, an error type and a small same-origin client for catalog/intake/auth. UI remains independent of unavailable services. |

## Verification

- Dependency installation, TypeScript, ESLint and Vite production build passed. npm reported that the pinned ESLint 9 release is deprecated. It remains compatible with the current configuration and plugins.
- Headless Chrome with Playwright exercised the final production build at **390, 768, 1024 and 1440 px**. At each width, 40 route views and six admin redirect or fallback cases rendered with a single main heading, a matching tab title and no page-level horizontal overflow. The full four-step quote flow and public and admin navigation passed at all four widths, including menu focus, filtering and pagination.
- The extended browser run also covered public form validation, FAQ, cookie preferences, login and recovery previews, staff record edits, quote and contract simulations, and local settings. The demo flows produced zero uncaught browser errors and zero API requests.
- Compared the matching Stitch HTML sources and rendered ten representative references in Chrome, covering home, catalog, quote wizard, dashboard and the two desktop quote admin screens. With remote photos blocked, reviewed hierarchy, responsive structure and spacing and refined the quote panel, utility bar and dashboard. Final photo cropping and logo parity remain pending approved assets.

**How to read the table.** Every row is implemented. **4 widths** means direct route rendering and no page-level horizontal overflow at the four requested widths. A named interaction means it was also exercised in a browser. Source paths, props, state, styling and endpoint handoffs are documented in [03 Frontend](03-FRONTEND.md).

| ID | Page / route | Implementation | Responsive | Browser checks | API / data | Known issue or release dependency |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | Accueil · `/` | Implemented | 4 widths | Mobile menu and catalog navigation | Local catalog; public service prepared | Approved photos, logo, partner content |
| P02 | Nos assurances · `/assurances` | Implemented | 4 widths | Audience filter and product navigation; mobile header compared with Stitch | Local catalog; public service prepared | Approved category imagery |
| P03 | Assurance automobile · `/assurances/automobile` | Implemented | 4 widths | Product → preselected quote | Local catalog; public service prepared | Approved visual and product copy |
| P04 | Assurance habitation · `/assurances/habitation` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved visual and product copy |
| P05 | Assurance santé · `/assurances/sante` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved visual and product copy |
| P06 | Assurance voyage · `/assurances/voyage` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved visual and product copy |
| P07 | Assurance professionnelle · `/assurances/professionnelle` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved visual and product copy |
| P08 | Responsabilité civile · `/assurances/responsabilite-civile` | Implemented | 4 widths | Legacy rc preselection | Local catalog; public service prepared | Approved visual and product copy |
| P09 | Demande de devis · `/devis` | Implemented | 4 widths | Steps, back, phone, consent, review and reset | Local catalog; public service prepared | No receipt until backend |
| P10 | Particuliers · `/particuliers` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved imagery and content |
| P11 | Professionnels · `/professionnels` | Implemented | 4 widths | Route smoke | Local catalog; public service prepared | Approved imagery and business copy |
| P12 | À propos · `/a-propos` | Implemented | 4 widths | Route smoke | Bundled content; no request | Approved imagery and agency copy |
| P13 | Contact · `/contact` | Implemented | 4 widths | Invalid phone and local verification | Local validation; public service prepared | Official email, address, hours and map pending |
| P14 | Assistance · `/assistance` | Implemented | 4 widths | Invalid phone and local verification | Local validation; public service prepared | Staff routing and notices pending |
| P15 | FAQ · `/faq` | Implemented | 4 widths | Search and accordion | Bundled content; no request | Final FAQ copy approval |
| P16 | Mentions légales · `/mentions-legales` | Implemented | 4 widths | Route smoke | Bundled content; no request | Publisher/legal/hosting details pending |
| P17 | Politique de confidentialité · `/politique-de-confidentialite` | Implemented | 4 widths | Route smoke | Bundled content; no request | Controller, notice version and retention pending |
| P18 | Politique de cookies · `/politique-de-cookies` | Implemented | 4 widths | Modal and Escape | Bundled content; no request | Essential-only preview |
| P19 | Page introuvable · `*` | Implemented | 4 widths | Unknown path layout | Bundled content; no request | Preview has SPA HTTP 200; production requires edge 404 |
| A01 | Connexion · `/admin/login` | Implemented | 4 widths | Format, unavailable service and demo entry | Local validation; auth service prepared | No authentication |
| A02 | Mot de passe oublié · `/admin/mot-de-passe-oublie` | Implemented | 4 widths | Email format and local acknowledgement | Local validation; auth service prepared | No recovery email |
| A03 | Réinitialisation du mot de passe · `/admin/reinitialiser-mot-de-passe` | Implemented | 4 widths | Password mismatch and local acknowledgement | Local validation; auth service prepared | No reset token or password update |
| A04 | Tableau de bord · `/admin/dashboard` | Implemented | 4 widths | Search deep link, mobile navigation and desktop sidebar | Fictional data; endpoint pending | Fixture metrics only |
| A05 | Demandes de devis · `/admin/demandes` | Implemented | 4 widths | Search and pagination | Fictional data; endpoint pending | Versioned/staff API and server pagination pending |
| A06 | Détails d’une demande · `/admin/demandes/:id` | Implemented | 4 widths | Update status, assign and add note | Fictional data; endpoint pending | Updates in memory |
| A07 | Clients · `/admin/clients` | Implemented | 4 widths | Route smoke | Fictional data; endpoint pending | Fictitious records |
| A08 | Profil client · `/admin/clients/:id` | Implemented | 4 widths | Edit path, archive dialog and refresh reset | Fictional data; endpoint pending | Server authorization pending |
| A09 | Ajouter / modifier un client · `/admin/clients/nouveau` · `/admin/clients/:id/modifier` | Implemented | 4 widths | Create and edit | Fictional data; endpoint pending | Duplicate warning is local |
| A10 | Devis · `/admin/devis` | Implemented | 4 widths | Route smoke | Fictional data; endpoint pending | V2 quotes are illustrative |
| A11 | Création de devis · `/admin/devis/nouveau` | Implemented | 4 widths | Preselection, amount validation and draft creation | Fictional data; endpoint pending | Mobile adaptation; demo carrier may be empty |
| A12 | Détails d’un devis · `/admin/devis/:id` | Implemented | 4 widths | Simulated issuance, decision and contract navigation | Fictional data; endpoint pending | Mobile adaptation; downloads disabled |
| A13 | Contrats · `/admin/contrats` | Implemented | 4 widths | Route smoke | Fictional data; endpoint pending | V2 policies are illustrative |
| A14 | Création / détails d’un contrat · `/admin/contrats/nouveau` · `/admin/contrats/:id` | Implemented | 4 widths | Date validation, draft and simulated activation | Fictional data; endpoint pending | No actual policies, PDFs or reminders |
| A15 | Demandes d’assistance · `/admin/assistance` | Implemented | 4 widths | Local status update and switch to messages | Fictional data; endpoint pending | Shared mobile inbox pattern |
| A16 | Catalogue des assurances · `/admin/assurances` | Implemented | 4 widths | Edit summary and visibility modal | Fictional data; endpoint pending | Local subset of V2 fields |
| A17 | Partenaires · `/admin/partenaires` | Implemented | 4 widths | Add example in modal | Fictional data; endpoint pending | No registered insurer, logos or publishing |
| A18 | Messages reçus · `/admin/messages` | Implemented | 4 widths | Local processed action | Fictional data; endpoint pending | Shared mobile inbox pattern |
| A19 | Paramètres · `/admin/parametres` | Implemented | 4 widths | Local update, locked main phone | Fictional data; endpoint pending | Official details require confirmation |

## Differences from the Stitch prototypes

- **Brand and photography.** The ZIP’s PNG contains the brand board, and the HTML contains inline prototype monograms. The standalone approved logo/lockup was unavailable, so the app uses a typographic brand-name placeholder. Neutral themed media regions preserve layout space. The homepage omits the unverified carrier block. No partner names, contact details, registration identifiers, premiums or promises are presented as verified business facts.
- **Intake.** The export’s mobile quote page only contains the start of a wizard. All four steps and the input review use the same controlled form at every width. Optional category selectors collect general context and fit within the documented needs text when integrated. Desktop/mobile contact and assistance use common required fields. The preview creates no submission, confirmation reference, session or email.
- **Admin design.** A11 and A12 adapt the desktop design to stacked mobile form/detail sections. The merged assistance/messages mobile reference uses a shared layout, two distinct routes and a switch link. Dashboard metrics derive from fixtures. Submit, archive, issue, activate and resolve actions change React memory. The banner and explicit demo entry distinguish the preview from the future secured console.
- **Supporting behavior.** Staff lists and legal content are local. The preferences dialog explains the essential-only posture. Admin catalog and settings changes affect only the demo. Client forms exclude CIN/ICE and medical information. Official phones are read-only.
- **Release.** Replace the demo entry and provider with real authentication and role-aware routes before entering live customer data. Connect persistence, SMTP/recovery, permissions/CSRF, server validation, PDF generation and renewals. Obtain approved assets, French policy copy and company details before publication.

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
