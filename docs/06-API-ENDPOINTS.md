# 06 — API endpoints

Same-origin JSON API under /api. Health, authentication, catalog, quote intake and staff processing, customer CRM, contact, assistance, issued quote management, private quote PDFs, local delivery, contract registration, renewals and the dashboard summary are implemented. Other business routes below describe upcoming phases. Status codes in the endpoint tables are in addition to the common errors below. The page IDs refer to the [frontend specification](03-FRONTEND.md).

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
| CatalogItem | Product plus isActive, isPublished, displayOrder, version |
| CatalogWrite | title (2–120), summary (10–300), audiences (1–2 unique), imageKey? (null or omitted until an approved manifest exists), potentialCoverages (max 12), eligibilityText (0–1000), documentHints (max 10), faqs (max 12, question 3–180, answer 10–1000), relatedSlugs (max 6 unique published other slugs), isActive? (defaults true at creation), isPublished, displayOrder (0–999). Nested titles max 120 and item strings max 1000. Slug is provided on create only and must be one of the six reserved slugs. |
| QuoteRequestIn | profile, productSlug, desiredStartOn? (today or later in Casablanca), situation? (default NEW_POLICY), context? (approved choice for the selected category, counts toward the needs limit), needs, firstName, lastName, phone, email, city, preferredContact? (default PHONE), noticeVersion, acknowledged |
| QuoteNotice | noticeVersion and text, both null when intake is disabled |
| ContactIn | fullName, phone, email, subject, message, noticeVersion, acknowledged |
| AssistanceIn | fullName, phone, productSlug, contractReference?, description, noticeVersion, acknowledged |
| RequestRow | id, reference, displayName, phone, productSlug, status, assignedTo?, createdAt, version |
| RequestDetail | RequestRow plus profile, firstName, lastName, email, city, preferredContact, desiredStartOn?, situation, needs, clientId?, client, assignee, productTitle, allowedStatuses[], noticeVersion, acknowledgedAt, updatedAt, notes[{id, body, authorName, createdAt}] |
| StaffOption | id, displayName |
| ClientIn | profile, displayName, phone, email?, city?, notes? (0–1000) |
| ClientRow | id, profile, displayName, phone, city?, archivedAt?, version, intakeProvisional, activeContractCount? (V2) |
| Client | ClientRow plus email?, notes?, createdAt, updatedAt |
| ClientDetail | Client plus recentRequests (up to 10 RequestRow), recentAssistance (up to 10 related cases), activity (up to 20 events), recentQuotes? and recentContracts? (V2, up to 10 each) |
| AssistanceRow | id, reference, fullName, productSlug, status, priority, assignedTo?, createdAt, version |
| AssistanceCase | AssistanceRow plus phone, contractReference?, description, noticeVersion, acknowledgedAt, updatedAt, client?, contract?, assignee?, allowedStatuses[], notes[], activity[] |
| MessageRow | id, reference, fullName, subject, status, archivedAt?, createdAt, version |
| Message | MessageRow plus phone, email, message, noticeVersion, acknowledgedAt, updatedAt |
| Dashboard | counts {totalRequests, newRequests, inReviewRequests, openRequests, activeClients, totalClients, provisionalClients, openAssistance, newAssistance, inReviewAssistance, unreadMessages}, recentRequests (up to 10 RequestRow), byProduct[{slug,title,count}], activity[{id,action,targetType,targetId,createdAt}], months[{month,count}], quoteCounts by status, recentQuotes (up to 8 QuoteRow), contractCounts, recentContracts (up to 8 ContractRow) |
| Trends | from, to, monthly[{month, requests}], byProduct[{productSlug, requests}], counts {draftQuotes, activeContracts, dueRenewals} |
| PartnerIn / Partner | Legal name, optional display name, private contacts, address and notes, optional HTTPS website, and category slugs. Reads add UUID, version and lifecycle state. Detail adds verification metadata and recent history. |
| QuoteIn | clientId, requestId?, productSlug, partnerId, annualPremiumMad, feesMad?, taxesMad?, validUntil?, coverage?, coverageLimits?, deductibles?, conditions?, customerNotes?, internalNotes?. Money fields are fixed-point decimal strings. |
| QuoteRow / Quote | id, reference, clientId, clientName, requestId?, partnerId, partnerName, productSlug, productTitle, status, annualPremiumMad, totalMad, currency, createdAt, issuedAt?, sentAt?, validUntil?, revision, version. Detail adds offer fields, decision metadata, revision history, PDF and delivery states. |
| ContractIn | effectiveOn, expiresOn (exclusive), policyNumber?, coverage?, premiumMad?, internalNotes?, renewalReminders?. Quote conversion requires quoteId and quoteVersion. External registration requires clientId, productSlug and partnerId. |
| ContractRow / Contract | Client, product, partner and optional quote IDs and labels, reference, status, version, dates, premium, currency and renewal links. Detail adds policy reference, coverage, confirmation, audit, snapshots, documents and reminder states. |
| DocumentRef | B8 quote PDF has id, status, revision, quoteVersion, mimeType, createdAt and delivery state. B9 insurer attachments have id, revision, createdAt and mimeType. They are download-only. |
| Settings | agencyName, officePhone, assistancePhone, email?, address? (max 300), hours? (max 300), version. Official name and numbers are locked to approved values. |

## Public, auth and operations

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/catalog | List visible products / Public | audience?: INDIVIDUAL or BUSINESS | 200 ProductCard[] | — | P01, P02, P09, P10, P11 |
| GET /api/catalog/:slug | Get visible product / Public | recognized slug | 200 Product | 404 unknown or hidden | P03–P08 |
| GET /api/quotes/notice | Read current quote notice / Public | no inputs | 200 QuoteNotice | — | P09 |
| POST /api/quotes | Create quote request / Public | QuoteRequestIn, UUID v4 idempotency header, active and published product for the supplied profile, valid notice | 201 {reference,receivedAt} | 409 replay mismatch, unavailable product or changed notice, 503 if disabled | P09 |
| GET /api/contact/notice | Read contact notice / Public | no inputs | 200 QuoteNotice | — | P13 |
| POST /api/contact | Create message / Public | ContactIn, idempotency header and valid notice | 201 {reference,receivedAt} | 409 replay mismatch or notice | P13 |
| GET /api/assistance/notice | Read assistance notice / Public | no inputs | 200 QuoteNotice | — | P14 |
| POST /api/assistance | Create assistance request / Public | AssistanceIn, idempotency header, active, published product, valid notice | 201 {reference,receivedAt} | 409 replay mismatch, unavailable product or notice | P14 |
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

The catalog returns an unpaginated bounded array. Health responses use bare probe bodies. The deployment proxy should keep `/api/health/live` and `/api/health/ready` internal. `Auth.expiresAt` is the earlier of the current idle and absolute deadlines.

## Operational admin

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/dashboard | Operational summary / Staff | no input | 200 Dashboard | — | A04 |
| GET /api/admin/dashboard/trends | Advanced stats / Staff · V2 | from, to required dates, from ≤ to, max 366 days | 200 Trends | — | A04 |
| GET /api/admin/quote-requests | Search intake / Staff | page, limit, q?, status?, productSlug?, assignedTo?, from?, to? (ordered dates) | 200 RequestRow list | — | A04–A06, A08 |
| GET /api/admin/quote-requests/:id | Read intake / Staff | UUID | 200 RequestDetail | 404 | A06 |
| PATCH /api/admin/quote-requests/:id | Process intake / Staff | {version,status?,assignedTo?,clientId?}; nullable assignee, client required when relinking, active staff and eligible client, permitted transition | 200 RequestDetail | 404, 409 stale/state | A06 |
| POST /api/admin/quote-requests/:id/notes | Append note / Staff | {version,body} 1–1000 chars | 201 RequestDetail with new note and version | 404, 409 stale | A06 |
| GET /api/admin/staff-options | Assignee options / Staff | q?, page, limit | 200 StaffOption list of active accounts | — | A06 |
| GET /api/admin/clients | CRM search and link selector / Staff | page, limit, q?, profile?, provisional?, archived? (default false) | 200 ClientRow list | — | A06–A09, A15 |
| POST /api/admin/clients/duplicates | Check candidate matches / Staff | phone, email?, excludeId? | 200 candidate IDs, display names and states | — | A09 |
| POST /api/admin/clients | Create / Staff | ClientIn, confirmDuplicate? | 201 Client | 409 duplicates | A09 |
| GET /api/admin/clients/:id | Profile / Staff | UUID | 200 ClientDetail | 404 | A08, A09 |
| PATCH /api/admin/clients/:id | Edit / Staff | {version,...partial ClientIn,verify?,confirmDuplicate?}, active record | 200 Client | 404, 409 stale/archived/duplicates | A09 |
| POST /api/admin/clients/:id/archive | Archive / Admin | {version}, no open quote request, open assistance case or unexpired active contract | 200 Client | 404, 409 stale/linked open | A08 |
| GET /api/admin/catalog | List catalog records / Staff | no inputs, bounded array | 200 CatalogItem[] | — | A16 |
| GET /api/admin/catalog/:id | Read a catalog record / Staff | UUID | 200 CatalogItem | 404 | A16 |
| POST /api/admin/catalog | Add a reserved product / Admin | CatalogWrite plus slug, all six slots already seeded unless approved migration leaves one open | 201 CatalogItem | 409 reserved slot exists | A16 |
| PATCH /api/admin/catalog/:id | Edit or change visibility / Admin | {version,...partial CatalogWrite}, validate references | 200 CatalogItem | 404, 409 stale/incompatible | A16 |
| GET /api/admin/assistance | Browse cases / Staff | page, limit, q?, status?, priority?, productSlug?, assignedTo?, reference? (exact), from?, to? | 200 AssistanceRow list | — | A15 |
| GET /api/admin/assistance/:id | Read case / Staff | UUID | 200 AssistanceCase | 404 | A15 |
| PATCH /api/admin/assistance/:id | Process case / Staff | {version,status?,priority?,assignedTo?,clientId?,contractId?}, valid state and verified links | 200 AssistanceCase | 404, 409 stale/state | A15 |
| GET /api/admin/assistance/:id/contract-options | Find eligible existing contracts / Staff | clientId, q?, page?, limit? | 200 list of contract IDs and references | 404 case absent | A15 |
| POST /api/admin/assistance/:id/notes | Append note / Staff | {version,body}, 1–1000 chars | 201 AssistanceCase | 404, 409 stale | A15 |
| GET /api/admin/messages | Browse messages / Staff | page, limit, q?, status?, reference? (exact), from?, to?, archived? | 200 MessageRow list | — | A18 |
| GET /api/admin/messages/:id | Read message / Staff | UUID | 200 Message | 404 | A18 |
| PATCH /api/admin/messages/:id | Mark read, unread or processed / Staff | {version,status}, valid transition | 200 Message | 404, 409 stale/state | A18 |
| POST /api/admin/messages/:id/archive | Archive a processed message / Staff | {version} | 200 Message | 404, 409 stale/state | A18 |

## Issued quotes and private PDFs · B8

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/quotes | List issued quote records and drafts / Staff | page, limit, q?, status?, productSlug?, clientId?, requestId?, from?, to? | 200 QuoteRow list | — | A08, A10 |
| GET /api/admin/quotes/partner-options | List verified, active partners / Staff | productSlug? limits choices to the matching category | 200 IDs and names | 400 invalid filter | A11, A14 |
| POST /api/admin/quotes | Create draft / Staff | QuoteIn, active client, verified active partner for category, product exists, request if supplied linked to same client and product | 201 Quote | 409 incompatible link | A11 |
| GET /api/admin/quotes/:id | Read quote / Staff | UUID | 200 Quote | 404 | A12 |
| PATCH /api/admin/quotes/:id | Edit draft / Staff | {version,...partial QuoteIn}, draft only and links consistent | 200 Quote | 404, 409 stale/state/link | A11, A12 |
| POST /api/admin/quotes/:id/issue | Lock and queue PDF / Admin | {version}, complete draft, valid business links | 202 Quote with queued DocumentRef | 404, 409 stale/state/link | A11, A12 |
| POST /api/admin/quotes/:id/decision | Record actual outcome / Admin | {version,status,method,evidence}, valid SENT quote | 200 Quote | 404, 409 stale/state | A12 |
| POST /api/admin/quotes/:id/send | Queue or retry delivery / Admin | {version}, valid ISSUED quote with ready PDF and verified email | 202 Quote | 404, 409 state, 503 disabled | A12 |
| POST /api/admin/quotes/:id/retry-pdf | Requeue failed PDF / Admin | {version}, valid issued quote with failed PDF | 202 Quote | 404, 409 state | A12 |
| POST /api/admin/quotes/:id/cancel | Cancel proposal / Admin | {version}, eligible status and no active delivery | 200 Quote | 404, 409 state | A12 |
| POST /api/admin/quotes/:id/revision | Create successor draft / Admin | {version}, issued history, eligible status and no successor or pending delivery | 201 Quote | 404, 409 state | A12 |
| GET /api/admin/documents/:id/download | Read ready quote PDF / Staff | UUID, inline=true for preview | 200 application/pdf with no-store | 404 absent/scope, 409 not ready, 503 storage | A12 |

## Contract registration and renewal · B9

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/contracts | List registered contracts / Staff | q?, page, limit, status?, clientId?, quoteId?, productSlug?, partnerId?, expiresFrom?, expiresTo?, renewals? | 200 ContractRow page | 400 invalid filters | A08, A13 |
| POST /api/admin/contracts | Convert accepted quote / Staff | versioned accepted quote and ContractIn date/offer fields | 201 Contract | 409 duplicate/stale/ineligible | A14 |
| POST /api/admin/contracts/external | Register external policy draft / Staff | explicit customer, category, carrier, dates and policy fields | 201 Contract | 409 state/duplicate | A14 |
| GET /api/admin/contracts/:id | Read policy / Staff | UUID | 200 Contract | 404 | A14 |
| PATCH /api/admin/contracts/:id | Edit draft / Staff | version and changed draft fields | 200 Contract | 404, 409 stale/state | A14 |
| POST /api/admin/contracts/:id/status | Confirm or cancel / Admin | version, status and insurer confirmation evidence or cancellation reason | 202 on confirmation, 200 on cancel | 404, 409 stale/state | A14 |
| POST /api/admin/contracts/:id/renew | Prepare successor / Staff | version, effectiveOn, expiresOn with no overlap | 201 Contract | 404, 409 duplicate/state | A14 |
| POST /api/admin/contracts/:id/documents | Attach PDF / Staff | version query, raw application/pdf body <=4 MiB | 201 Contract | 403 access, 409 state/stale, 413 size, 415 type, 422 format, 503 disabled | A14 |
| GET /api/admin/documents/:id/download | Retrieve insurer PDF / Staff | UUID and ready private record, attachment only | 200 application/pdf, no-store | 404, 409 not ready, 503 storage | A14 |

## Partner management · B10

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/partners | List published carriers / Public | No input, returns verified and active records with explicit publication | 200 name and optional website | — | P01 |
| GET /api/admin/partners | List carriers / Staff | page, limit, q?, status?, active?, productSlug? | 200 paginated list | 400 invalid filters | A13, A17 |
| GET /api/admin/partners/:id | Read carrier / Staff | Partner UUID | 200 details, activity and recent quotes/contracts | 404 missing | A17 |
| POST /api/admin/partners | Create carrier draft / Admin | PartnerIn, unique case-insensitive legal name | 201 Partner detail | 409 duplicate, 422 validation | A17 |
| PATCH /api/admin/partners/:id | Edit or change state / Admin | Current version, partial PartnerIn, isActive?, isPublished? | 200 Partner detail | 404 missing, 409 state/stale/duplicate, 422 validation | A17 |
| POST /api/admin/partners/:id/verify | Verify carrier / Admin | Current version, reference, stored category scope | 200 Partner detail | 404 missing, 409 state/stale, 422 validation | A17 |

## Proposed settings administration

| Method and URL | Purpose / permission | Request and validation | Success body | Other errors | Pages |
| --- | --- | --- | --- | --- | --- |
| GET /api/admin/settings | Read settings / Admin | no body | 200 Settings | — | A19 |
| PATCH /api/admin/settings | Save approved values / Admin | {version,email?,address?,hours?}, approved values only, nullable, at least one change | 200 Settings | 409 stale | A19 |

Status rules and coupling between staff actions are in [User flows](09-USER-FLOWS.md). No hard-delete customer API is proposed. Retention runs through restricted maintenance workflows. Contact and assistance have no public status or document endpoints.
