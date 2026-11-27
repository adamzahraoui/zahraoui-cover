# 20 — Customer CRM

The staff console now uses PostgreSQL for customer search, profiles, creation, edits, verification and archives. The console keeps its French interface and the existing responsive list and profile patterns.

## What a customer record represents

- A quote request from a public visitor creates a provisional customer and keeps the original contact details in the request snapshot. A general contact message or an assistance request creates no customer.
- A customer entered by authorized staff starts verified. On a provisional profile, staff can check **J’ai vérifié l’identité et les coordonnées de ce client** during an edit. The server records the verification in the same transaction as the updated version.
- A change to a phone or email, a manual create, or a provisional verification may match another record. The server compares normalized phones and case-insensitive emails, then asks staff to review possible duplicates. Keep a separate record only after explicitly confirming it. Shared contact details are valid. When the existing profile is the correct one, use the request's client picker to relink it. Staff never merge the two profiles automatically.

## API contracts

All endpoints require a valid staff session. POST and PATCH also require the CSRF token. Customer archive additionally requires the ADMIN role.

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /api/admin/clients` | Optional `q`, `profile`, `provisional=true\|false`, `archived=true\|false`, `page`, `limit`. Search uses prefixes of names, emails, phones, cities and linked quote/assistance references. Active profiles are the default. | 200 with `data` and pagination `meta`. Returns the fields required by lists and selectors. |
| `GET /api/admin/clients/:id` | Customer UUID. | 200 with the profile, up to ten recent quotes **requested**, up to ten recent assistance cases, and up to twenty customer activity events. Includes archived profiles. |
| `POST /api/admin/clients` | `ClientIn`, plus optional `confirmDuplicate: true` after review. | 201 with the saved profile. |
| `POST /api/admin/clients/duplicates` | `phone`, optional `email`, and optional `excludeId` for the current profile. The body keeps contact details out of the browser URL. | 200 with up to ten matching customer IDs, display names and verification/archive indicators. |
| `PATCH /api/admin/clients/:id` | Last-read `version` and fields to change. Optional `verify: true` and `confirmDuplicate: true`. | 200 with the new version and saved profile. |
| `POST /api/admin/clients/:id/archive` | Last-read `version`. | 200 with the archived profile. Open quote requests, new or in-progress assistance cases, and active contracts block archival. |

`ClientIn` requires an individual or professional profile, a 2–120 character display name and a valid telephone number. Optional fields are email, city and notes. Send null to clear an optional field. Invalid input returns 422. Missing records return 404. A stale version, an archived edit, an unconfirmed duplicate or a blocked archive returns 409. Staff can reload a record after a stale edit.

## Follow the code

1. [Clients.tsx](../frontend/src/pages/admin/Clients/Clients.tsx) stores the search in React state, keeps filters and page in the URL, and renders the page and total returned by Express.
2. [ClientForm.tsx](../frontend/src/pages/admin/ClientForm/ClientForm.tsx) uses standard form fields and reads them with `FormData`. It sends JSON through [api.ts](../frontend/src/services/api.ts), displays duplicate candidates after a conflict and keeps the draft available while staff review them.
3. [ClientProfile.tsx](../frontend/src/pages/admin/ClientProfile/ClientProfile.tsx) displays contact details, the current verification state, related records and history. It opens an archive confirmation dialog for administrators.
4. [The CRM router](../backend/src/modules/clients/routes.ts) normalizes contact details and checks version numbers. Transaction-scoped locks serialize duplicate checks in CRM writes. Archive holds the client row lock while checking open work, and links to that profile use a compatible shared lock. Updates, verification and archive write a redacted audit record in the same transaction.
5. [The quote request editor](../frontend/src/pages/admin/QuoteRequestDetail/QuoteRequestDetail.tsx) uses the same list endpoint for staff relinking. [Assistance](21-CONTACT-ASSISTANCE-IMPLEMENTATION.md) adds a verified customer relation to the existing case table. Related records and historical events remain after archival.

The CRM uses the existing `clients.intake_provisional` column. Migration [20261127020000](../backend/prisma/migrations/20261127020000_crm_support/migration.sql) adds assistance relationships to existing tables. Issued quote and contract histories remain for later phases. A future merge workflow would need explicit rules for transferring each type of relationship and retaining an audit trail.

## Verification

The [support integration tests](../backend/tests/support.integration.ts) cover creation, editing, duplicate confirmation, verification, relationship history, search, pagination, archived profiles, staff permissions and CSRF.

The B6–B7 Chrome workflow created a customer, verified a provisional customer, updated its details, opened the linked quote request and refreshed the profile at 390, 768, 1024 and 1440 px. Tests use synthetic records in isolated PostgreSQL databases. [Implementation status](15-IMPLEMENTATION-STATUS.md)
