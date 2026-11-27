# 04 — Backend

The foundation, database schema and auth module are implemented. The remaining module descriptions define the target behavior for later phases. [Backend implementation report](16-BACKEND-IMPLEMENTATION.md)

| Module | Owns |
| --- | --- |
| Auth | Provisioning command, login, sessions, CSRF, revocation, recovery and auth audit. |
| Catalog | Six fixed slugs, approved product and audience metadata, V2 product editing and visibility. |
| Intake | Quote/contact/assistance validation, references, idempotency, authorized case handling. |
| Clients | Staff search, duplicate hints, create/update/archive, explicit linkage. |
| Dashboard | Real counts and recent requests in MVP, dated series and aggregates in V2. |
| Notifications | Transactional outbox, SMTP retry and operational alerts. |
| Quotes / contracts | V2 draft, issue, decision, policy lifecycle and renewal scheduling. |
| Partners / settings | V2 partner data, approved agency profile and audit. |
| Documents | V2 generated versions, authorized delivery and cleanup. |

## Validation and persistence

Parse JSON with a size cap, reject unknown fields, validate path and query parameters, normalize email and phone and enforce enum values. A random public idempotency key maps to a submission response for 24 hours. Store a keyed fingerprint of the canonical body. Check existing keys before revalidating time-dependent fields or current product/notice configuration. Identical repeats return the original reference. A changed body with the same key returns 409. Concurrent inserts use the unique key and retry the read after a losing transaction. Generate opaque references with database uniqueness and retry transient collisions.

Staff updates require the last-read version. Atomically compare and advance it or return 409. Use stable sort and bounded pages. Bind query parameters and allowlist sort/filter columns. Link clients explicitly and retain the original intake snapshot. Public intake never creates client records. Transactionally validate active linked records and write corresponding audit events.

## Email and background work

An intake transaction records the submitted privacy notice version and enqueues an internal alert containing only a reference and authentication-gated link. When approved and email exists, send a generic acknowledgement with the reference. V2 renewal alerts start with approved internal recipients. Email addresses are resolved from approved settings or validated records at send time. Reset links are the only emails with an authentication secret. Encrypt the reset job token with a dedicated key and clear it on delivery, expiry or terminal failure.

Staff alert links point to the authorized quote detail route or the appropriate support list filtered by exact reference. The worker claims bounded batches with row locks and leases, sends outside the transaction, and records outcomes. Retry transient delivery with capped backoff and alert on terminal failure. SMTP delivery is at least once. Preserve stable message IDs across retries. V2 PDF tasks use approved quote/contract snapshots and trusted templates with escaped text and external fetching disabled. Write via temporary files and publish atomically, reconcile files with metadata and checksum on retry.

Keep logs structured, redact personal content, and record request IDs, route templates and aggregate outcomes. Retention jobs use approved cutoffs, bounded transactions and counts-only reporting.
