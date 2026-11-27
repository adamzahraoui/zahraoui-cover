# 06 — API endpoints

Same-origin JSON API under /api. Health and authentication are implemented. The business routes below remain proposals, MVP unless marked **V2**. Status codes in the endpoint tables are in addition to the common errors below. The page IDs refer to the [frontend specification](03-FRONTEND.md).

## Conventions and validation

- Required fields are shown without '?'. Omitted optional create fields stay null or take their documented default. PATCH changes only supplied fields. Nullable fields can be cleared with null when marked as optional in the corresponding write DTO. Reject unknown fields and no-op update bodies. Normalize with trim, Unicode-safe length validation and input-specific rules.
- JSON responses use {data: T}. Lists use {data: T[], meta: {page, limit, total}}. 204 has no body. Dates are YYYY-MM-DD, timestamps are ISO 8601 UTC. IDs are UUIDs. Admin URL parameters accept UUIDs. Public confirmation references are distinct opaque strings. Use version: positive integer on mutable staff records and pass it back on update.
- Standard errors use {error: {code, message, fields?: Record<string,string>, requestId}}. Return 400 MALFORMED_REQUEST for malformed JSON/path/query, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 422 VALIDATION_FAILED for field rules, 429 RATE_LIMITED with Retry-After, and 500 INTERNAL_ERROR. Use 503 temporarily when the service cannot safely accept a request. Staff endpoints additionally return 401 UNAUTHENTICATED or 403 FORBIDDEN. Unsafe browser requests require origin validation and authenticated mutations require X-CSRF-Token. 403 CSRF_FAILED distinguishes that failure. For under-scope objects use 404. Errors contain no input echoes or stack traces.
- Access codes are **Public**, **Staff** (ADVISOR and ADMIN) and **Admin** (ADMIN). Permissions apply to the record as well as the route. Staff and auth responses are no-store.
- Page starts at 1, limit defaults to 20 and maxes at 100. Lists use a stable sort with an ID tiebreaker. Search q is trimmed to 2–100 characters when set. Look up PII only through authorized lists. Treat query strings as sensitive in logs.
- For public intake POSTs require Idempotency-Key (random UUID) plus noticeVersion, matching the configured published form notice, and acknowledged: true. Replay identical payloads for 24 hours with the original status/reference, even after a notice or product change. Changed payload returns 409 IDEMPOTENCY_CONFLICT. Stale notice returns 409 NOTICE_CHANGED. Public responses contain {reference, receivedAt}, with no public record lookup.
- Common rules: name/company 2–120 chars, city 2–100 when supplied, email max 254 with syntax check, phone validated and normalized to E.164 (up to 15 digits), subject 3–120, free text 10–1000 unless noted, contract reference 1–64. For optional case narratives and notes, instruct users and staff to omit sensitive information. Product slugs map to six seeded values and visibility is checked for new public requests.
- Status, profile, audience, contact preference and situation values are defined in [database enums](05-DATABASE.md). Money is a decimal string with two places, positive within NUMERIC(12,2), and currency MAD. Neither rates nor cover promises are prepopulated.

## DTOs

| DTO | Fields |
| --- | --- |
| Auth | id, email, displayName, role, expiresAt, csrfToken |
| ProductCard | id, slug, title, summary, audiences[], imageKey? |
| Product | ProductCard plus potentialCoverages[{title, description}], eligibilityText, documentHints[], faqs[{question, answer}], relatedSlugs[] |
| CatalogItem | Product plus isPublished, displayOrder, version |
| CatalogWrite | title (2–120), summary (10–300), audiences (1–2 unique), imageKey? (approved manifest key), potentialCoverages (max 12), eligibilityText (0–1000), documentHints (max 10), faqs (max 12, question 3–180, answer 10–1000), relatedSlugs (max 6 unique published other slugs), isPublished, displayOrder (0–999). Nested titles max 120 and item strings max 1000. Slug is provided on create only and must be one of the six reserved slugs. |
| QuoteRequestIn | profile, productSlug, desiredStartOn? (today or later in Casablanca), situation? (default NEW_POLICY), needs, firstName, lastName, phone, email, city, preferredContact? (default PHONE), noticeVersion, acknowledged |
| ContactIn | fullName, phone, email, subject, message, noticeVersion, acknowledged |
| AssistanceIn | fullName, phone, productSlug, contractReference?, description, noticeVersion, acknowledged |
| RequestRow | id, reference, displayName, phone, productSlug, status, assignedTo?, createdAt, version |
| RequestDetail | RequestRow plus profile, firstName, lastName, email, city, preferredContact, desiredStartOn?, situation, needs, clientId?, noticeVersion, acknowledgedAt, updatedAt, notes[{id, body, authorName, createdAt}] |
| StaffOption | id, displayName |
| ClientIn | profile, displayName, phone, email?, city?, notes? (0–1000) |
| ClientRow | id, profile, displayName, phone, city?, archivedAt?, version, activeContractCount? (V2) |
| Client | ClientRow plus email?, notes?, createdAt, updatedAt |
| ClientDetail | Client plus recentRequests (up to 10 RequestRow), recentQuotes? and recentContracts? (V2, up to 10 each) |
| AssistanceRow | id, reference, fullName, productSlug, status, priority, createdAt, version |
| AssistanceCase | AssistanceRow plus phone, contractReference?, description, noticeVersion, acknowledgedAt, updatedAt |
| MessageRow | id, reference, fullName, subject, status, createdAt, version |
| Message | MessageRow plus phone, email, message, noticeVersion, acknowledgedAt, updatedAt |
| Dashboard | counts {newRequests, openRequests, activeClients, openAssistance, unreadMessages}, recentRequests (up to 10 RequestRow) |
| Trends | from, to, monthly[{month, requests}], byProduct[{productSlug, requests}], counts {draftQuotes, activeContracts, dueRenewals} |
| PartnerIn / Partner | name, website? (HTTPS only, max 300), logoKey? (approved manifest), isActive; read adds id, version. No publishable partner defaults. |
| QuoteIn | clientId, requestId?, productSlug, partnerId, annualPremiumMad, conditions? (0–2000) |
| QuoteRow / Quote | id, reference, clientId, clientName, productSlug, status, annualPremiumMad, currency, createdAt, version; detail adds requestId?, partnerId, conditions?, issuedAt?, decidedAt?, documents[] (DocumentRef) |
| ContractIn | clientId, quoteId?, productSlug, partnerId, policyNumber (2–64), effectiveOn, expiresOn (after effectiveOn) |
| ContractRow / Contract | id, reference, clientId, clientName, productSlug, partnerId, partnerName, expiresOn, status, version; detail adds quoteId?, policyNumber, effectiveOn, createdAt, documents[] (DocumentRef) |
| DocumentRef | id, kind, status, revision, createdAt, downloadUrl? (same-origin, ready only) |
| Settings | agencyName, officePhone, assistancePhone, email?, address? (max 300), hours? (max 300), version. Official name and numbers are locked to approved values. |

## Public, auth and operations

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/catalog | List visible products / Public | audience?: INDIVIDUAL or BUSINESS | 200 ProductCard[] | — | P01, P02, P09, P10, P11 |
| GET /api/catalog/:slug | Get visible product / Public | recognized slug | 200 Product | 404 unknown or hidden | P03–P08 |
| POST /api/quotes | Create quote request / Public | QuoteRequestIn, idempotency header, published product and valid notice | 201 {reference,receivedAt} | 409 replay mismatch or notice | P09 |
| POST /api/contact | Create message / Public | ContactIn, idempotency header and valid notice | 201 {reference,receivedAt} | 409 replay mismatch or notice | P13 |
| POST /api/assistance | Create assistance request / Public | AssistanceIn, idempotency header, published product, valid notice | 201 {reference,receivedAt} | 409 replay mismatch or notice | P14 |
| POST /api/auth/login | Start a session / Public | {email,password}, validate syntax and password length cap | 200 Auth + Set-Cookie | 401 INVALID_CREDENTIALS, 429 RATE_LIMITED | A01 |
| GET /api/auth/session | Restore current session / Staff | cookie, no body | 200 Auth | 401 expired or missing | A01, A04–A19 |
| POST /api/auth/logout | End current session / Staff | cookie + CSRF, no body | 204 + clear cookie | — | A04–A19 |
| POST /api/auth/change-password | Update current account password / Staff | cookie + CSRF, {currentPassword,newPassword}, new password 15–128 chars | 204 + clear cookie, revoke existing sessions | 422 CURRENT_PASSWORD_INVALID, 429 RATE_LIMITED | A04–A19 top bar |
| POST /api/auth/forgot-password | Request reset / Public | {email} | 202 {accepted:true} | generic body for absent/disabled account | A02 |
| POST /api/auth/reset-password | Consume reset / Public | {token,password}, base64url token of 32 random bytes and password 15–128 chars | 204 | 422 RESET_INVALID for unknown/expired/used | A03 |
| GET /api/health | Process probe / Public | no inputs | 200 {status:"ok"} | — | — |
| GET /api/health/live | Process probe / Internal | no inputs | 200 {status:"ok"} | — | — |
| GET /api/health/ready | Migration and DB probe / Internal | no inputs | 200 {status:"ready"} | 503 {status:"unavailable"} | — |
| GET /api/admin/access | Permission probe / Admin | session cookie | 200 {role:"ADMIN"} | 401 UNAUTHENTICATED, 403 FORBIDDEN | — |

Catalog will return an unpaginated bounded array. Health responses use bare probe bodies. The deployment proxy should keep `/api/health/live` and `/api/health/ready` internal. `Auth.expiresAt` is the earlier of the current idle and absolute deadlines.

## Operational admin

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/dashboard | Operational summary / Staff | no input | 200 Dashboard | — | A04 |
| GET /api/admin/dashboard/trends | Advanced stats / Staff · V2 | from, to required dates, from ≤ to, max 366 days | 200 Trends | — | A04 |
| GET /api/admin/quote-requests | Search intake / Staff | page, limit, q?, status?, productSlug?, assignedTo?, from?, to? (ordered dates) | 200 RequestRow list | — | A04–A06, A08 |
| GET /api/admin/quote-requests/:id | Read intake / Staff | UUID | 200 RequestDetail | 404 | A06 |
| PATCH /api/admin/quote-requests/:id | Process intake / Staff | {version,status?,assignedTo?,clientId?}; nullable links, existing active staff/client, permitted transition | 200 RequestDetail | 404, 409 stale/state | A06 |
| POST /api/admin/quote-requests/:id/notes | Append note / Staff | {version,body} 1–1000 chars | 201 RequestDetail with new note and version | 404, 409 stale | A06 |
| GET /api/admin/staff-options | Assignee options / Staff | q?, page, limit | 200 StaffOption list of active accounts | — | A06 |
| GET /api/admin/clients | Search / Staff | page, limit, q?, profile?, archived? (default false) | 200 ClientRow list | — | A06, A07, A09, A11, A14 |
| POST /api/admin/clients | Create / Staff | ClientIn | 201 Client | — | A09 |
| GET /api/admin/clients/:id | Profile / Staff | UUID | 200 ClientDetail | 404 | A08, A09 |
| PATCH /api/admin/clients/:id | Edit / Staff | {version,...partial ClientIn}, active record | 200 Client | 404, 409 stale/archived | A09 |
| POST /api/admin/clients/:id/archive | Archive / Admin | {version}, no open request or active contract | 200 Client | 404, 409 stale/linked open | A08 |
| GET /api/admin/assistance | Browse cases / Staff | page, limit, status?, priority?, reference? (exact) | 200 AssistanceRow list | — | A15 |
| GET /api/admin/assistance/:id | Read case / Staff | UUID | 200 AssistanceCase | 404 | A15 |
| PATCH /api/admin/assistance/:id | Process case / Staff | {version,status?,priority?}, valid transition | 200 AssistanceCase | 404, 409 stale/state | A15 |
| GET /api/admin/messages | Browse messages / Staff | page, limit, status?, reference? (exact) | 200 MessageRow list | — | A18 |
| GET /api/admin/messages/:id | Read message / Staff | UUID | 200 Message | 404 | A18 |
| PATCH /api/admin/messages/:id | Mark read/processed / Staff | {version,status}, valid transition | 200 Message | 404, 409 stale/state | A18 |

## Version 2 administration

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/quotes | List issued quote records and drafts / Staff | page, limit, status?, clientId?, requestId? | 200 QuoteRow list | — | A08, A10 |
| POST /api/admin/quotes | Create draft / Staff | QuoteIn, active client/partner, product exists, request if supplied linked to same client and product | 201 Quote | 409 incompatible link | A11 |
| GET /api/admin/quotes/:id | Read quote / Staff | UUID | 200 Quote | 404 | A12 |
| PATCH /api/admin/quotes/:id | Edit draft / Staff | {version,...partial QuoteIn}, draft only and links consistent | 200 Quote | 404, 409 stale/state/link | A11, A12 |
| POST /api/admin/quotes/:id/issue | Lock and queue PDF / Admin | {version}, complete draft, valid business links | 202 Quote with queued DocumentRef | 404, 409 stale/state/link | A11, A12 |
| POST /api/admin/quotes/:id/decision | Record actual outcome / Admin | {version,status}; ACCEPTED or DECLINED from ISSUED only | 200 Quote | 404, 409 stale/state | A12 |
| GET /api/admin/contracts | List policies / Staff | page, limit, status?, clientId?, expiresFrom?, expiresTo? (ordered dates) | 200 ContractRow list | — | A08, A13 |
| POST /api/admin/contracts | Save draft / Staff | ContractIn, valid links, accepted source quote if provided, unique carrier/policy number and source quote | 201 Contract | 409 existing/incompatible | A14 |
| GET /api/admin/contracts/:id | Read policy / Staff | UUID | 200 Contract | 404 | A14 |
| PATCH /api/admin/contracts/:id | Edit draft / Staff | {version,...partial ContractIn}, valid date/link checks as on create | 200 Contract | 404, 409 stale/state/link | A14 |
| POST /api/admin/contracts/:id/status | Activate or cancel / Admin | {version,status}, eligible transition, activation queues PDF and renewal | 202 Contract on activation; 200 on cancel | 404, 409 stale/state | A14 |
| GET /api/admin/documents/:id/download | Stream PDF / Staff | UUID, authorized parent, ready and present private file | 200 application/pdf, no-store, attachment with safe filename | 404 absent/scope, 409 not ready, 503 storage | A12, A14 |
| GET /api/admin/catalog | List catalog records / Staff | no inputs, bounded array | 200 CatalogItem[] | — | A11, A14, A16 |
| POST /api/admin/catalog | Add a reserved product / Admin | CatalogWrite plus slug, all six slots already seeded unless approved migration leaves one open | 201 CatalogItem | 409 reserved slot exists | A16 |
| PATCH /api/admin/catalog/:id | Edit or change visibility / Admin | {version,...partial CatalogWrite}, validate references | 200 CatalogItem | 404, 409 stale/incompatible | A16 |
| GET /api/admin/partners | List carriers / Staff | page, limit, q?, active? | 200 Partner list | — | A11, A14, A17 |
| POST /api/admin/partners | Create carrier / Admin | PartnerIn, unique case-insensitive name | 201 Partner | 409 duplicate | A17 |
| PATCH /api/admin/partners/:id | Edit or deactivate / Admin | {version,...partial PartnerIn} with same rules | 200 Partner | 404, 409 stale/duplicate | A17 |
| GET /api/admin/settings | Read settings / Admin | no body | 200 Settings | — | A19 |
| PATCH /api/admin/settings | Save approved values / Admin | {version,email?,address?,hours?}, approved values only, nullable, at least one change | 200 Settings | 409 stale | A19 |

Status rules and coupling between staff actions are in [User flows](09-USER-FLOWS.md). No hard-delete customer API is proposed. Retention runs through restricted maintenance workflows. Contact and assistance have no public status or document endpoints.
