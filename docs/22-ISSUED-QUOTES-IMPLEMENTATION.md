# 22 — Issued insurance proposals

Zahraoui Cover is an insurance broker. A **demande de devis** records what the visitor needs. A **devis** is the agency’s proposal prepared from a verified carrier offer. A customer decision is recorded by staff. Coverage and contracts have their own future workflow.

## Work through the screens

1. Open **Demandes de devis**, select a request and choose **Créer un devis**. React reads the existing request and preselects its client and category. The standalone **Nouveau devis** screen also supports a named client and category.
2. Select a verified, active partner eligible for the chosen category. Enter the actual coverage, limits, deductibles, conditions/exclusions, premium, fees, taxes and validity date. Keep internal notes in their own field. The React editor sends amount strings and uses the server’s calculated total.
3. Save the draft. Staff can edit it using its last-read version. An administrator selects **Générer le PDF** to freeze the proposal. The page reports the worker’s progress and shows preview and download links once the PDF is ready.
4. Verify the customer's identity and email in CRM. An administrator can then queue an email for the exact PDF. The interface displays the result of the mail transport. See [PDF and delivery](23-PDF-AND-DELIVERY-IMPLEMENTATION.md).
5. Once the customer decision is verified, an administrator records acceptance or refusal, the communication method and a supporting reference or note. The server records the time and staff member. Find the persisted proposal again in **Devis**, on the customer profile and on the dashboard.

[QuoteEditor](../frontend/src/components/admin/QuoteEditor.tsx) uses standard form inputs and React state for the selected customer, feedback and loaded carrier options. [QuoteCreate](../frontend/src/pages/admin/QuoteCreate/QuoteCreate.tsx) loads the optional source request. [Quotes](../frontend/src/pages/admin/Quotes/Quotes.tsx) supports server paging and filters. [QuoteDetail](../frontend/src/pages/admin/QuoteDetail/QuoteDetail.tsx) shows proposal fields, delivery state, decision form and revision links. The shared [IssuedQuoteList](../frontend/src/components/admin/IssuedQuoteList.tsx) also renders CRM and dashboard history.

## API

All endpoints require the existing staff session. Every POST and PATCH also requires the CSRF token. Mutations on an existing quote require its last-read integer `version`. Administrators perform issuance, delivery and decision operations.

| Method and endpoint | Purpose and contract |
| --- | --- |
| `GET /api/admin/quotes` | Staff list. Supports `q`, `status`, `productSlug`, `clientId`, `requestId`, inclusive Casablanca creation dates `from`/`to`, `page` and `limit`. Returns `{data, meta}`. |
| `GET /api/admin/quotes/partner-options` | Staff selector. Up to 100 verified, active partner IDs and names. Pass `productSlug` to restrict choices to the matching category. |
| `POST /api/admin/quotes` | Staff creates a draft. Requires `clientId`, `productSlug`, `partnerId`, `annualPremiumMad`. Optional fields include `requestId`, `feesMad`, `taxesMad`, `validUntil`, `coverage`, `coverageLimits`, `deductibles`, `conditions`, `customerNotes` and `internalNotes`. Returns 201 detail. |
| `GET /api/admin/quotes/:id` | Staff detail with prices, offer terms, PDF and delivery metadata, revision links and any recorded customer decision. |
| `PATCH /api/admin/quotes/:id` | Staff saves a partial draft update with `version`. A corrected revision retains the original request, client and insurance category. |
| `POST /api/admin/quotes/:id/issue` | Admin, `{version}`. Checks required terms and dates, stores the snapshot, queues its PDF and returns 202 detail. |
| `POST /api/admin/quotes/:id/retry-pdf` | Admin, `{version}`. Requeues the existing failed generation job and returns 202. |
| `POST /api/admin/quotes/:id/send` | Admin, `{version}`. Queues or retries delivery of the exact ready PDF and returns 202. |
| `POST /api/admin/quotes/:id/decision` | Admin, `{version,status,method,evidence}`. Status is `ACCEPTED` or `DECLINED`. Method is `EMAIL`, `PHONE`, `IN_PERSON` or `LETTER`. Evidence is a 3–1000 character note or reference. Returns 200. |
| `POST /api/admin/quotes/:id/cancel` | Admin, `{version}`. Cancels an eligible draft, issued or sent quote. Returns 200. |
| `POST /api/admin/quotes/:id/revision` | Admin, `{version}`. Copies an eligible frozen offer into a new draft with its own ID and reference. Returns 201. |
| `GET /api/admin/documents/:id/download` | Staff downloads the private quote PDF. Set `inline=true` for a new-tab preview. |

Unknown records return 404. Stale versions or forbidden transitions return 409. Invalid inputs, including unsupported monetary formats, return 422.

## Rules implemented in Express and PostgreSQL

- `DRAFT` is editable. `ISSUED` is frozen and its PDF can be queued, ready or failed. The worker moves a quote to `SENT` after SMTP accepts it. A valid sent offer can move to `ACCEPTED` or `DECLINED`. Expiration is effective after the end of the specified Casablanca calendar day. A draft, issued or sent offer can be cancelled outside an active delivery.
- [The quote router](../backend/src/modules/quotes/routes.ts) uses row locks and versions to reject concurrent stale changes. Issuance stores the customer, carrier, terms, dates and price snapshot. The PDF points to this version even when later actions increment the quote's version. Corrections create a successor draft with a new validity date and preserve previous documents. Creating a successor cancels an issued or sent predecessor. A quote family is limited to 50 revisions.
- [The money model](../backend/src/modules/quotes/model.ts) adds `annualPremiumMad + feesMad + taxesMad` using Prisma Decimal. The columns use PostgreSQL `DECIMAL(12,2)`. Prime must be positive, fees and taxes nonnegative, and the total cannot exceed 9,999,999,999.99 MAD. Staff supply the actual components. Rates and taxes are never inferred.
- The linked request becomes `QUOTE_SENT` only after successful delivery. Staff record decisions on the quote. Acceptance updates the linked request. Refusing one of several viable offers leaves the request sent. Refusing the last viable offer marks it declined. A successfully sent replacement can reopen a declined request. Expiration or cancellation of an offer retains the request’s delivery history. Existing request notes remain intact.
- The API validates client/category consistency with the request and uses a verified, active partner eligible for the requested category. Delivery requires a verified active CRM client and the email frozen at issuance. An updated email requires a new revision. A pending delivery blocks incompatible changes to the client email or linked request.
- The dashboard counts effective statuses and shows recent issued quotes. CRM shows the latest ten real proposals, with a link to the complete paged list.

The quote changes extend existing tables in [migrations](../backend/prisma/migrations/). B10 records agency verification and category scope in the [partner module](26-PARTNER-MANAGEMENT-IMPLEMENTATION.md). Issued snapshots retain the legal name recorded at issuance. The seed creates no real carriers, prices or coverage terms. A staff record of a decision is evidence of operational follow-up. It does not create a signature, policy, payment or coverage.
