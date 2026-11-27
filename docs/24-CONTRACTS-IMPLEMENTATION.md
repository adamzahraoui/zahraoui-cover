# 24 — Contract registration

A quote request records a customer's needs. An accepted proposal records the customer's decision. The contract screen records a policy that an insurance carrier has confirmed. Zahraoui Cover acts as a broker. A draft, a signed-in user action or a reminder does not create insurance coverage.

## Follow the workflow

1. In **Devis**, open an accepted and still-valid proposal and choose **Créer le contrat**. [ContractForm](../frontend/src/pages/admin/ContractForm/ContractForm.tsx) loads the quote and checks whether a contract already exists. The draft inherits its client, category, approved carrier and offer snapshot. Set the insurer's dates and review the recorded premium and coverage before saving.
2. If the insurer has already provided a policy independently of this app, choose **Enregistrer une police externe** from **Contrats**. [ContractEditor](../frontend/src/pages/admin/ContractForm/ContractEditor.tsx) uses this separate path with staff-selected client, category and carrier. Both paths create a draft. They accept an empty policy number until the insurer provides one.
3. An administrator chooses **Confirmer et activer** after checking the actual carrier confirmation. The action requires the policy number, coverage, positive MAD premium, valid period, insurer confirmation reference and date, a verified active customer and an active carrier. The server records the staff member and freezes the activation snapshot. Confirmation dated after today's Casablanca calendar date is rejected.
4. An administrator can cancel a draft or an unexpired confirmed record, with a reason. Expired policies and previous terms remain identifiable in history. See [renewal preparation](25-RENEWALS-AND-REMINDERS-IMPLEMENTATION.md) for linked successor records.

The stored status is `DRAFT`, `ACTIVE`, `EXPIRED` or `CANCELLED`. The web detail derives **Effet futur** for a confirmed `ACTIVE` row before the effective date, and **Confirmation manquante** for a legacy row without a B9 confirmation record. An active term begins at the start of its effective date and ends before the start of its expiration date in Africa/Casablanca. Drafts represent records awaiting validation. A confirmed successor is shown separately in the original record.

## API endpoints

All endpoints require the existing staff session. Every write requires CSRF. Each change to an existing contract requires its current `version`. The database validates one contract per accepted quote and one reserved policy number per carrier. Expired, declined, cancelled, stale or otherwise ineligible source quotes cannot be converted. Production refuses conversion of B8 development offers.

| Endpoint | Input and result |
| --- | --- |
| `GET /api/admin/contracts` | `q` matches internal reference, insurer policy number or customer prefix. Filters include `status`, `productSlug`, `partnerId`, `clientId`, `quoteId`, `expiresFrom`, `expiresTo`, `renewals=true`, `page` and `limit`. Returns `{data, meta}`. |
| `POST /api/admin/contracts` | `quoteId`, `quoteVersion`, `effectiveOn` and `expiresOn`. Optional policy fields are `policyNumber`, `premiumMad`, `coverage`, `internalNotes` and `renewalReminders`. Returns the draft with 201. |
| `POST /api/admin/contracts/external` | Same policy fields and dates, plus `clientId`, `partnerId`, and `productSlug`. Returns an external-policy draft with 201. |
| `GET /api/admin/contracts/:id` | Staff detail with confirmation, source snapshot, authorized document identifiers, reminders and renewal history. |
| `PATCH /api/admin/contracts/:id` | Version plus changed draft fields. Returns saved detail with the new version. |
| `POST /api/admin/contracts/:id/status` | Admin. `{version,status:"ACTIVE",confirmationReference,confirmationOn}` or `{version,status:"CANCELLED",reason}`. Returns 202 on confirmation with scheduled jobs, or 200 on cancellation. |
| `POST /api/admin/contracts/:id/renew` | Staff. `{version,effectiveOn,expiresOn}`. Returns the successor draft with 201. |
| `POST /api/admin/contracts/:id/documents?version=…` | Staff. A raw `application/pdf` body up to 4 MiB. Allowed in local testing for draft, confirmed active or future records. Returns 201 with the updated contract and a document ID. |
| `GET /api/admin/documents/:id/download` | Staff. Returns the verified insurer PDF as an attachment. The document ID identifies its exact parent. Quote PDF previews retain their B8 behavior. |

The React [contract list](../frontend/src/pages/admin/Contracts/Contracts.tsx) requests matching pages from the API. [ContractDetail](../frontend/src/pages/admin/ContractForm/ContractDetail.tsx) uses controlled action feedback, versioned forms, the supporting PDF picker and history links. The customer profile and dashboard use the same record list. Assistance staff can link an eligible customer and matching contract. The assistance form keeps anonymous policy text separate from the verified link, and the staff UI displays recorded status without predicting assistance eligibility.

## Privacy and storage

[The contract router](../backend/src/modules/contracts/routes.ts) checks MIME and file size, requires a PDF signature and classic cross-reference table, and rejects recognizable active names, encryption and compressed object containers. This narrow test path can reject otherwise legitimate PDFs. It does not perform malware scanning. Production upload is disabled. The server writes under a generated UUID in the B8 private directory, with exclusive publication, a 0600 file and SHA-256 verification on read. The download filename uses the internal reference and revision number. PDFs are attachment-only. The server never exposes a raw file path or the user's filename. New files append a revision number and preserve old documents. A failed transaction removes a known orphan when the database can confirm that it has no matching row.

The migration reuses the existing contract, document and job tables. It adds accepted source and insurer confirmation fields, a nullable insurer reference for drafts, date/cancellation/pricing data and a successor relation. Money is stored as `DECIMAL(12,2)`; the browser sends strings. Existing policy numbers, statuses, quotes and documents are preserved. See the [database model](05-DATABASE.md) and [verification results](15-IMPLEMENTATION-STATUS.md).
