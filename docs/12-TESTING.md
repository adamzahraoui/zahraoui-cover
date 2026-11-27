# 12 — Testing and release verification

Run the same requested journeys at 390px and 1440px, plus 320px and intermediate tablet widths around 768px and 1024px. Include a keyboard-only pass and zoom/reflow checks. Use a real isolated PostgreSQL schema for constraints and transactions, a captured SMTP sink and sanitized fixtures. Compare visuals against the corresponding export using approved assets. Treat missing references and mobile parity decisions as design-review checks.

| Layer | Cases and acceptance |
| --- | --- |
| Unit | Normalize phone, email and slugs; French date rules; status/role matrix; form and record validators; opaque links; retry and renewal cutoff. Boundary lengths and invalid enums are rejected. |
| Backend integration | Prisma migration from empty DB and existing MVP data, FK/unique/check failures, deterministic search and pagination, transactions round-trip desired dates and decimals, correct status codes and response fields, private responses are no-store. |
| Intake integration | Anonymous quote, contact and assistance success each create one record and alert job. Replaying the same key returns the same reference with parallel submits. Changed data returns 409. Invalid payload, privacy version or rolled-back transaction creates no record and no email. |
| Auth integration | Correct cookie attributes, hashed persistence, session renewal/expiry/revocation, identical recovery response and unknown-account handling, reset use once under concurrency, CSRF and origin enforcement, rate limits and role permissions. |
| Staff integration | Search exact phone/reference and name prefixes, assignment requires active staff, client linking never overwrites intake, conflicts preserve first write, archive rules honor linked state. Audit entries avoid message bodies and secrets. |
| V2 lifecycle | Issuing locks terms and queues one document, contract requires compatible accepted quote when linked, duplicate carrier/policy disallowed, reminders respect active dates, retries preserve document revision, private byte stream requires allowed record. |
| Worker and resilience | Commit then SMTP failure, retry after crash/lease expiry, terminal failure and operator signal, no late reset emails, no body/secret in logs. Exercise DB outage, disabled worker, missing/corrupt file, restart and restores. |
| End to end, public | All routes, French titles, official phones, product filters/links, FAQ, actual four-step wizard, one confirmation, mobile field parity, legal links, keyboard and 404/failure branches. |
| End to end, admin | Sign in/recover, search intake, update/assign/note/link, create/edit/archive client, handle assistance/contact, session expiry and role gates. V2 verify quote → PDF → accepted policy/renewal. |
| Security QA | Authorization and data visibility checks per role, rejection of malformed content, safe rendering of stored inputs, CSRF checks, rate/size limits, CSP, HTTPS and private volume access controls. Check API/logs for unintended customer data. |
| Accessibility and visual QA | Approved ZC, colors, Inter and French copy. Verify accessible names and labels, focus visibility/restoration, keyboard drawer/dialog, announcement of results, errors and loading, color-independent status, AA contrast and absence of horizontal spill. |
| Deployment QA | Backup restore timed and signed off, no real outbound test messages, staging smoke, health, certificate renewals and migrations. Compare ZIP hash to recorded value. |

For each release, link requirements to tests and record screenshots for representative routes and variant behavior. Treat fixture names, registration values, insurance partners, addresses, quotes and credentials as test-only data. Release only after production content, assets, consent language and launch operations are signed off.
