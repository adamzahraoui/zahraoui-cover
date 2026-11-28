# 34 — Production readiness

**READY FOR CONTROLLED STAGING.** B14 verified a local production build with isolated PostgreSQL, Mailpit and private file storage. Controlled staging uses synthetic data. Live release requires the approvals and operational evidence below.

## Architecture and features

React, TypeScript and Vite provide the public and administration applications. Express serves the JSON API and can also serve the compiled frontend. PostgreSQL holds data through Prisma. The separate worker processes durable outbox jobs for email, PDFs and renewals. Authenticated endpoints stream private documents from a separate volume.

| Phases | Implemented |
| --- | --- |
| Frontend, B1–B3 | Responsive public and admin UI, PostgreSQL, staff authentication, recovery and sessions. |
| B4–B5 | Public and admin insurance catalog, four-step quote intake, staff queue, notes and assignment. |
| B6–B7 | Customer CRM, verification and duplicate review, contact and assistance intake and processing. |
| B8 | Issued quote revisions, immutable PDFs, local delivery and acceptance/decline records. |
| B9 | Draft and confirmed insurer contracts, renewal drafts and internal reminders. |
| B10 | Partner verification, categories, activation, publication and eligibility checks. |
| B11 | Private document history, download, controlled uploads and archive rules. |
| B12 | Bounded XLSX/CSV templates, preview, confirmation, history and staff exports. |
| B13 | Approved agency information, immutable legal versions, notification and renewal configuration, staff invitations and access management, issued PDF snapshots. |
| B14 | Security and quality hardening, gated SEO, responsive and accessibility fixes, audits and recovery drill. |

The agency records insurer confirmation. An accepted quote or a renewal draft does not activate coverage. Local SMTP, production upload and production import restrictions remain enforced.

## Deployment sequence

1. Build immutable artifacts from lockfiles. Generate the Prisma client in CI and inventory dependencies in the runtime image. Run the API and worker as non-root. Separate runtime, migration and database backup permissions.
2. Keep PostgreSQL on a private network. Provision durable encrypted database and private document volumes. Use quotas and a storage path outside the frontend. Keep Mailpit out of the production network.
3. Set up Nginx for HTTPS and the exact configured origin. Strip client-supplied forwarding headers and set the hop count to the actual topology. Proxy the app-hosted HTML, robots and sitemap while preserving its status and headers. Restrict health endpoints to private monitoring. Apply request timeouts and size limits.
4. Provision runtime secrets outside the image and source tree. Stage with synthetic data and external delivery disabled. Run Prisma migrations once with a migration role. Then start the API and worker. Confirm readiness and measure behavior behind the proxy.
5. Configure supervised restarts, CPU and memory limits, log rotation, and alerts on DB health, API latency/errors, TLS expiry, private storage space, queue age/failures and backup age. Assign incident and recovery ownership.
6. Rehearse [recovery](35-BACKUP-AND-RECOVERY.md) with the operator. Decide the rollback window and verify whether the last image can run against the upgraded schema.

B15A provides a [dedicated Compose stack for controlled staging](38-STAGING-DEPLOYMENT.md). The existing Compose file remains the local dependency harness. No external environment was deployed.

## Release approvals and blockers

| Approval or evidence | Required before live release |
| --- | --- |
| Official standalone logo and approved photography | Obtain approved assets and usage rights. Current typography and generic artwork are interim. |
| Official contact and registration information | Confirm public phone, assistance details, address, email, hours and the applicable regulatory or registration identifiers. |
| Insurance descriptions and partners | Approve descriptions and verify relationships and categories before publishing. |
| Legal notices, privacy, cookies and quote wording | Obtain business and qualified legal approval. Leave indexing disabled pending approved publication. |
| Production SMTP | Approve provider, TLS, sender authentication, reply routing, sensitive message handling and delivery/bounce monitoring. Local-only business email paths have separate production gates. |
| Malware scanning and durable private storage | Approve quarantine, testing, access and retention before enabling uploads. |
| Retention and data rights | Approve expiry, removal, backup retention, audit access and handling of customer data. The audit provides no regulatory certification. |
| Legacy workbook and migration | Review a private approved sample, mappings, duplicates, validations and rollback. B14 inspected no real workbooks. |
| Backup and recovery | Approve a recovery operator, hosting/storage, encryption and offsite retention, then repeat the drill at an appropriate scale. |
| HTTPS and proxy | Verify public origin, forwarding, TLS, cookie behavior, redirects and headers in controlled staging. |
| Runtime dependency inventory | The Prisma advisories were resolved in the locked npm install. Review the remaining Debian image findings in the [Docker infrastructure guide](39-DOCKER-INFRASTRUCTURE-GUIDE.md), then scan the assembled production images against current advisories before release. |

Public API outputs are field-limited and intake avoids document uploads and confidential medical details. Agree who may export records and how long downstream extracts may be stored before allowing any production data migration.
