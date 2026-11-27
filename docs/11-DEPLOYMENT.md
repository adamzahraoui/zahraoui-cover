# 11 — Deployment and operations

## Compose topology

| Service | Configuration |
| --- | --- |
| nginx | Public 80/443 only, HTTP-to-HTTPS redirect after ACME challenge, certificate rotation, SPA/static delivery and /api proxy. Deny access to /api/health paths on the public interface. |
| backend | Private access from Nginx, one process serving HTTP, health readiness checks database and schema version. Trust only the topology's configured proxy hop and strip unsolicited forwarded headers. |
| worker | Same backend build image, runs the outbox and maintenance jobs. Connects to PostgreSQL and approved SMTP. No public listener. |
| postgres | Private network, persistent volume, separate runtime/migration/backup roles and production credentials. |
| migrate | One-shot command with migration role, run explicitly and serialized before deploying new app/worker versions. |

Serve hashed static assets with immutable caching and app HTML with revalidation. Route application navigations to the SPA, preserve API and missing static file error codes, and return the branded 404 with HTTP 404 for unmatched public paths via a route manifest where possible. Client-side catalog visibility still handles hidden products. Require strict admin no-store data behavior and no indexing of admin pages. Use approved French metadata and publish only public routes in the sitemap.

## Configuration proposal

| Environment key | Use |
| --- | --- |
| PUBLIC_ORIGIN | Canonical HTTPS origin for request checks and notification links. |
| DATABASE_URL, MIGRATION_DATABASE_URL | Separate DSNs scoped to runtime and migration jobs. |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM | Approved provider, account and sender. Require TLS for delivery. |
| INTAKE_NOTIFY_EMAIL | Explicit approved internal routing destination. |
| RESET_JOB_KEY, RATE_KEY_SECRET, IDEMPOTENCY_KEY_SECRET | Separate random keys for reset job encryption and keyed hashing. |
| PRIVACY_NOTICE_VERSION | Deployed notice version, matched in the frontend build. |
| SESSION_IDLE_MINUTES, SESSION_ABSOLUTE_HOURS, RESET_TOKEN_MINUTES | Session/recovery caps with safe defaults. |
| PRIVATE_DOCUMENT_DIR | V2 private persistent path, available only to the authorized API/worker. |
| RENEWAL_LEAD_DAYS | V2 approved number of days before expiry. Start with one configurable internal reminder. |
| LOG_LEVEL | Operational log verbosity, with redaction across environments. |

Future .env.example lists placeholders only. Do not put secrets into Vite variables or committed files. Provision certificates and server secrets outside images. Use a local mail sink and synthetic data in dev/staging. Stage should exercise the same proxy/cookie topology with HTTPS.

## Release and restore

1. Build reproducible images from lockfiles and run QA. Test schema upgrades on a staging copy without live personal data.
2. Back up production DB and V2 files, run migrations once, start API/worker and verify readiness. Use expand/backfill/contract migrations for destructive changes and preserve rollback compatibility during rollout.
3. Smoke-test official links, catalog/details, quote acknowledgement, private access and SMTP outbox. Track latency, queue age, failed jobs, DB health, TLS expiry and backup age. Rotate and redact logs.
4. If a rollout fails, roll back the image only if schema-compatible. A rollback requiring restore follows incident recovery approval, checks data loss and replays recorded removals before serving traffic.

Proposed MVP recovery targets are 24h RPO and 4h RTO, subject to operator approval and a timed restore rehearsal. Take encrypted daily backups with recovery checks, match the file snapshot to the V2 database, and store copies away from the app host in approved locations. Isolate restore drills from production mail and customer access. Reconcile queued jobs and private files after recovery.
