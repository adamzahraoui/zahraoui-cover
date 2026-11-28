# 04 — Backend

The foundation, staff authentication, catalog, anonymous quote intake, customer CRM, contact, assistance, issued quote management, private quote PDFs, local delivery, contract registration, renewals, partner management, centralized document management, spreadsheet import and export, and dashboard summary are implemented. For current behavior see [Backend foundation](16-BACKEND-IMPLEMENTATION.md), [Live catalog](18-INSURANCE-CATALOG-IMPLEMENTATION.md) and [Quote requests](19-QUOTE-REQUEST-IMPLEMENTATION.md).

| Module | Owns |
| --- | --- |
| Auth | Provisioning command, login, sessions, CSRF, revocation, recovery and auth audit. |
| Catalog | Six fixed slugs, approved product and audience metadata, staff reads, Admin editing, publication and deactivation. |
| Intake | Quote/contact/assistance validation, references, idempotency, authorized case handling. |
| Clients | Provisional records from quote intake, staff search, verified records, duplicate confirmation, explicit relinking and guarded archival. |
| Dashboard | Live request and quote counts, recent records, category breakdown, monthly series and activity. Contract metrics include effective, scheduled, expiring and expired terms. |
| Notifications | Transactional outbox, SMTP retry and operational alerts. |
| Quotes | B8 drafts, decimal totals, issue snapshot, delivery, revisions and verified decision tracking. |
| Contracts | Draft registration, insurer confirmation, expiration, cancellation and linked renewal preparation. |
| Partners | Verified carrier records and category scope, administrator lifecycle changes, public publication and offer eligibility. |
| Settings | Proposed approved agency profile and audit. |
| Documents | Staff inventory and history, generated quote previews, private checksummed downloads, local contract PDF uploads and restricted archival. |

B13 adds agency publication, staff administration and worker preference lookups. Intake and quote issuance record immutable text and identity snapshots. The existing environment gates continue to control production operations. [B13 agency settings](30-AGENCY-SETTINGS-IMPLEMENTATION.md)

## Validation and persistence

B12 previews bounded XLSX and CSV files in memory and confirms them in a single PostgreSQL transaction. Imports share the existing validators and creation services. Spreadsheet bytes are never stored in private PDF storage. [Import and export](28-EXCEL-IMPORT-EXPORT-IMPLEMENTATION.md)

Parse JSON with a size cap, reject unknown fields, validate path and query parameters, normalize email and phone and enforce enum values. A random public idempotency key maps to a submission response for 24 hours. Store a keyed fingerprint of the canonical body. Check existing keys before revalidating time-dependent fields or current product/notice configuration. Identical repeats return the original reference. A changed body with the same key returns 409. A transaction-scoped advisory lock serializes attempts for the same key, and the database enforces uniqueness. Generate opaque references with database uniqueness and retry transient collisions.

Staff updates require the last-read version. Atomically compare and advance it or return 409. Use stable sort and bounded pages. Bind query parameters and allowlist sort/filter columns. Create a provisional client in the public quote transaction and retain the original intake snapshot. Staff can explicitly relink after verifying customer identity. Anonymous intake cannot modify an existing client. Transactionally validate active linked records and write corresponding audit events.

## Email and background work

The public intake transaction records the acknowledged privacy notice version. If SMTP is enabled and an approved recipient is configured, it queues an internal alert with a reference and authentication-gated link. Quote and contact acknowledgements are independently configurable. Assistance provides an on-screen reference and can send an internal alert. B9 renewal alerts use a configured internal recipient on loopback SMTP. Email addresses are resolved from approved settings or validated records at send time. Reset links are the only emails with an authentication secret. Encrypt the reset job token with a dedicated key and clear it on delivery, expiry or terminal failure.

Staff alert links point to the authorized quote detail route or the appropriate support list filtered by exact reference. The worker claims bounded batches with row locks and leases, sends outside the transaction, and records outcomes. Retry transient delivery with capped backoff and alert on terminal failure. SMTP delivery is at least once. Preserve stable message IDs across retries. B8 PDF jobs render frozen snapshots using the template for local development. Document text is rendered directly and external fetching stays disabled. Write via temporary files and publish atomically, reconcile files with metadata and checksum on retry.

Keep logs structured, redact personal content, and record request IDs, route templates and aggregate outcomes. Retention jobs use approved cutoffs, bounded transactions and counts-only reporting.
