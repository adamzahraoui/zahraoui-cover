# 08 — Security and personal data

Treat all submitted data, staff-facing enquiries and generated PDFs as private. The public surface consists of approved catalog/content and anonymous form writes. Only active authorized staff can read customer records. Review the staff scope in [Authentication](07-AUTHENTICATION.md).

| Area | Required control |
| --- | --- |
| Transport | HTTPS for all production traffic. Add HSTS after HTTPS is proven. Require a verified TLS connection to SMTP and verify DB transport as applicable across network boundaries. |
| Authentication | Argon2id, named staff accounts, short-lived hashed reset tokens, session rotation/revocation and Secure HttpOnly SameSite cookies. Require server permission checks per endpoint and resource. |
| CSRF | Validate the trusted origin for unsafe methods, require a session-bound header token for staff actions, require correct content type and disallow credentialed cross-origin access. Logout uses POST. |
| Limits and abuse | Apply Nginx size and source buckets plus PostgreSQL account/form limits. Initial staging defaults: 5 failed logins per account and 20 per source per 15 minutes, five recovery requests per source and three sends per account per hour, 10 new submissions per source per form per 15 minutes. Tune from abuse and legitimate traffic. Return Retry-After on source/form throttles. Recovery keeps its generic response for account limits. Do not log raw credentials, identifiers or addresses used as limit keys. |
| Validation and SQL | Limit JSON bodies to 32 KiB, reject unknown fields, validate enum/date/text/ID constraints including query parameters, use Prisma parameter binding and allowlisted sort keys. Restrict raw SQL to parameterized operations such as leases and approved migrations. |
| XSS and browser scope | Render submitted data as escaped text in React, email and PDFs. Avoid raw HTML, inline handlers and arbitrary URL schemes. Use a CSP with self-hosted scripts/fonts/images, frame-ancestors none, base-uri none, form-action self and no object embedding. Apply nosniff, strict referrer handling and limited browser permissions. |
| Document access | Private volume outside web root. Resolve generated storage keys through the authorized record. Serve PDF via scoped API with attachment, no-store and fixed type. Keep file names and path construction independent of user input. Require authorization for historical versions and tested handling of missing or corrupt files. |
| Audit | Record auth attempts and session revocations, privileged reads of record detail/PDFs, exports if approved, staff actions, mutations and maintenance. Store actor ID, target ID, time, outcome and changed fields/status only. Protect audit tables from ordinary writes outside the event path and limit access to designated operators. |
| Personal data minimization | Collect the operational contact fields and general coverage needs shown in the contracts. No identity number, attachments, medical history/diagnoses, or account creation for public forms. Display guidance beside open-text fields. Route inadvertently disclosed sensitive data to a restricted review and deletion process. |
| Infrastructure | Keep PostgreSQL private with roles for application, migrations and backups. Limit secrets to their services, scrub reverse proxy and app logs, set admin/API no-store and redact personal fields from error reporting. Protect configuration and backups with access controls and key rotation. |

Use health routes and metrics that expose no business data. Alert authorized operators on abnormal authentication attempts, repeated mail failures and overdue backups using counts and request identifiers. Use separate, approved operator procedures for account provisioning, incident response and access revocation.

Staff CRM and inbox detail endpoints require a valid staff session and record a redacted view event. Writes also require CSRF and the current version. Customer archive requires ADMIN. Public support requests are rate-limited and idempotent, and return only a receipt. Contract matching happens in the staff workflow after customer verification.

Private B8 PDFs use an authenticated UUID endpoint, an integrity digest and a private directory. Quote emails use the frozen, verified customer email. Development PDF issuance and the loopback-only delivery path are gated from production. [PDF and delivery](23-PDF-AND-DELIVERY-IMPLEMENTATION.md)

B9 adds attachment-only insurer PDF retrieval and local PDF uploads with size, MIME and signature validation. Production uploads remain disabled while malware scanning and the approved policy are pending. Insurer confirmation and cancellation require ADMIN, CSRF and the current version. [Contract document security](24-CONTRACTS-IMPLEMENTATION.md)

B10 partner details and audit history require staff authentication. Only administrators can create, edit, verify, activate or publish partners. The server checks CSRF and the last-read version on updates. The public API sends an approved name and optional HTTPS website only. Logo uploads are deferred pending approved image validation. [Partner management](26-PARTNER-MANAGEMENT-IMPLEMENTATION.md)

B11 centralizes document reads and audits access. Each download checks the document parent, readiness, private file and checksum. Generated quote PDFs retain inline preview. Uploaded PDFs use attachment-only responses. Upload and archive require CSRF and use version checks. A shared account limit bounds upload attempts and only administrators can archive eligible supporting records. [Document security and recovery](27-DOCUMENT-MANAGEMENT-IMPLEMENTATION.md)

## Privacy before launch

- Assign a controller and an approved privacy contact. Review data categories, lawful basis, rights and records with the agency's privacy adviser. The acknowledgement fields record the published notice and timestamp. The owner must confirm where a separate consent record and controls are required. [CNDP website compliance](https://www.cndp.ma/conformite-des-sites-web/)
- Complete the applicable CNDP notification or authorization steps. Confirm any transfer obligations for hosting, email, backup and vendors and record processor responsibilities. [CNDP notification procedures](https://www.cndp.ma/procedures-de-notification-process/) · [CNDP international transfers](https://www.cndp.ma/transfert-de-donnees-a-letranger/)
- Publish accurate French legal and privacy notices. Establish authorized workflows for access/correction and other applicable rights, identity verification with minimal collection, and a redacted record of completion. Approve the [retention schedule](05-DATABASE.md) and document exceptions.
- Keep analytics disabled initially. If approved later, capture valid preferences before activation, allow withdrawal, version choices and use the current privacy policy.

## Backup and recovery

Encrypt snapshots in transit and at rest with keys held separately. Scope restore access to operators, rotate snapshots and track retention. Match V2 file and database backups, test isolated restores, validate integrity and reapply verified post-snapshot removals. Disable worker outbound mail and real notifications during recovery tests. Document triage, containment, session revocation, credential rotation and the owner-approved notification process. The [deployment plan](11-DEPLOYMENT.md) defines proposed recovery targets.
