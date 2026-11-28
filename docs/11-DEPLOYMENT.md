# 11 — Deployment and operations

The [local setup](../backend/README.md) uses Compose for PostgreSQL and optional loopback Mailpit. The full production topology below remains a deployment plan.

## Compose topology

| Service | Configuration |
| --- | --- |
| nginx | Public 80/443 only, HTTP-to-HTTPS redirect after ACME challenge, certificate rotation, same-origin proxy for app-hosted HTML, assets, robots, sitemap and API. Deny access to /api/health paths on the public interface. |
| backend | Private access from Nginx, one process serving HTTP, health readiness checks database and schema version. Trust only the topology's configured proxy hop and strip unsolicited forwarded headers. |
| worker | Same backend build image, runs the outbox and maintenance jobs. Connects to PostgreSQL and approved SMTP. No public listener. |
| postgres | Private network, persistent volume, separate runtime/migration/backup roles and production credentials. |
| migrate | One-shot command with migration role, run explicitly and serialized before deploying new app/worker versions. |

Set `FRONTEND_DIST_DIR` to the absolute path of the compiled frontend. The application serves hashed assets with immutable caching, public HTML with revalidation and admin HTML with no-store. It preserves public and missing asset/API 404s. Forward the status codes and headers through Nginx. Leave `PUBLIC_INDEXING_ENABLED=false` in staging. See [the SEO approval gate](33-PERFORMANCE-SEO-ACCESSIBILITY.md).

## Configuration proposal

| Environment key | Use |
| --- | --- |
| PUBLIC_ORIGIN | Canonical HTTPS origin for request checks and notification links. |
| DATABASE_URL | Set the runtime DSN on the API/worker and inject a separate migration DSN under this key in the one-shot job. |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM | Approved provider, account and sender. Require TLS for delivery. |
| INTAKE_NOTIFY_EMAIL | Explicit approved internal routing destination. |
| RESET_JOB_KEY, RATE_KEY_SECRET, CSRF_SECRET, IDEMPOTENCY_KEY_SECRET | Distinct random keys for reset job encryption and keyed hashes. |
| PRIVACY_NOTICE_VERSION | Optional fallback notice version used alongside a configured text and idempotency key. Published database versions take precedence. |
| Session and recovery limits | Server constants. See [authentication](07-AUTHENTICATION.md). |
| QUOTE_PDF_DIR | Private persistent absolute path, outside the workspace and web root, available only to the authorized API and worker. |
| RENEWAL_REMINDER_DAYS | Environment fallback for approved internal reminder offsets. Stored agency preferences take precedence. |
| FRONTEND_DIST_DIR, PUBLIC_INDEXING_ENABLED | Optional same-origin built frontend and explicit production-only SEO gate. |

The example environment file lists placeholders only. Do not put secrets into Vite variables or committed files. Provision certificates and server secrets outside images. Use a local mail sink and synthetic data in dev/staging. Stage should exercise the same proxy/cookie topology with HTTPS.

## Release and restore

1. Build reproducible images from lockfiles and run QA. Test schema upgrades on a staging copy without live personal data.
2. Back up production DB and private files, run migrations once, start API/worker and verify readiness. Use expand/backfill/contract migrations for destructive changes and preserve rollback compatibility during rollout.
3. Smoke-test official links, catalog/details, quote acknowledgement, private access and SMTP outbox. Track latency, queue age, failed jobs, DB health, TLS expiry and backup age. Rotate and redact logs.
4. If a rollout fails, roll back the image only if schema-compatible. A rollback requiring restore follows incident recovery approval, checks data loss and replays recorded removals before serving traffic.

Proposed MVP recovery targets are 24h RPO and 4h RTO, subject to operator approval and a timed restore rehearsal. Take encrypted daily backups with recovery checks, match the file snapshot to the database, and store copies away from the app host in approved locations. Isolate restore drills from production mail and customer access. Reconcile queued jobs and private files after recovery.

See [production readiness](34-PRODUCTION-READINESS.md), [backup and recovery](35-BACKUP-AND-RECOVERY.md) and [local verification workflows](37-GITHUB-ACTIONS-CI-CD.md).
