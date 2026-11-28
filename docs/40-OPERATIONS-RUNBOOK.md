# 40 — Staging operations runbook

Run these commands from the repository root with Bash. The array keeps the staging Compose file and environment consistent.

```bash
stage=(docker compose --env-file .env.staging -f compose.staging.yml)
"${stage[@]}" build
"${stage[@]}" up -d --wait
"${stage[@]}" ps -a
"${stage[@]}" logs --tail 100 proxy backend worker migrate postgres mailpit
"${stage[@]}" stop
```

## Health, migrations and first administrator

```bash
curl -fsS http://127.0.0.1:8088/robots.txt
"${stage[@]}" exec -T backend node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{ console.log(await r.text()); if(!r.ok) process.exit(1) })"
"${stage[@]}" exec -T worker node worker-health.mjs
"${stage[@]}" run --rm --no-deps migrate node node_modules/prisma/build/index.js migrate status
"${stage[@]}" run --rm --no-deps migrate node node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

The API readiness probe is available only from inside the API container or its private network. After an approved change, take a backup, stop the API and worker, build the new images, then run `"${stage[@]}" up -d --wait`. Compose waits for PostgreSQL, applies existing migrations via the one-shot service and only then starts the application. To apply explicitly while the application is stopped and PostgreSQL is healthy, use `"${stage[@]}" run --rm --no-deps migrate`. Exit status 0 is expected. Preserve volume contents during rollbacks.

Create the first administrator after startup. At the prompt, use a synthetic address ending in `.invalid` and a display name.

```bash
"${stage[@]}" exec backend node dist/src/modules/auth/create-admin.js
"${stage[@]}" logs --tail 50 worker
"${stage[@]}" exec -T worker node -e "fetch('http://mailpit:8025/api/v1/messages').then(r=>r.json()).then(d=>console.table(d.messages.map(m=>({ID:m.ID,Subject:m.Subject}))))"
```

To read that synthetic message privately, substitute its ID in the following command. Open the setup URL in the same loopback browser origin. The link is single-use and expires after 30 minutes. Keep it out of shared logs or chat.

```bash
"${stage[@]}" exec -T worker node -e "fetch('http://mailpit:8025/api/v1/message/' + process.argv[1]).then(r=>r.json()).then(m=>console.log(m.Text))" MAIL_ID
```

Run or restart only the worker with `"${stage[@]}" up -d worker` or `"${stage[@]}" restart worker`. Mailpit listings are available to Docker operators through this internal worker connection.

## Snapshot and isolated restore

Use a private destination with access restricted to the backup operator. The script pauses API and worker writes and resumes the services that were running. Plan for the short interruption. Save the release revision and secure references to the corresponding configuration and reset keys separately.

```bash
mkdir -m 700 -p backups
scripts/staging-backup.sh zahraoui-staging .env.staging backups/staging-snapshot
(cd backups/staging-snapshot && sha256sum -c SHA256SUMS)
```

Make a distinct private restore environment file and give it independent database credentials and keys for the drill. Use a new restore project name each time.

```bash
scripts/staging-restore.sh zahraoui-staging-restore-drill .env.staging.restore backups/staging-snapshot
docker compose --env-file .env.staging.restore -f compose.staging.yml -p zahraoui-staging-restore-drill ps
docker compose --env-file .env.staging.restore -f compose.staging.yml -p zahraoui-staging-restore-drill stop
```

The restore accepts only a fresh staging-restore project. It checks the three archive digests, inspects the private archive's paths and types, restores PostgreSQL in one transaction and verifies Prisma drift and every ready document. Only the new PostgreSQL service stays running after verification. Treat archives as private, use trusted sources, and verify signatures or equivalent provenance when transferring them across environments. A SHA-256 manifest detects damage and does not authenticate a sender. Reconcile pending emails, password resets and sessions before promoting any restored service. See the [recovery guide](35-BACKUP-AND-RECOVERY.md).

## Troubleshooting

- **Proxy fails readiness.** Inspect API readiness and migration exit status. Check that the configured loopback port is free. Look up Nginx configuration errors with `"${stage[@]}" logs proxy`.
- **Migration fails.** Review `"${stage[@]}" logs migrate postgres` and Prisma migration status. Preserve the two volumes and stop service changes until the failed migration is understood.
- **Worker shows unhealthy.** Check database health, Mailpit and private-volume ownership. Inspect `"${stage[@]}" logs worker` and `"${stage[@]}" exec -T worker stat -c '%u %g %a' /private-documents`. Expected permissions are UID 1000, mode 0700.
- **Form returns an origin error.** Use the exact browser URL from the configuration. Requests forwarded by Nginx use that same origin.
- **Recreation is needed.** Run `"${stage[@]}" up -d --force-recreate --wait`. The named volumes remain attached. Use ordinary `stop` for daily shutdown.
- **Docker cannot allocate another subnet.** Retire a specific, unused test project with `docker compose ... down` without the volume flag, then use a new restore project name. This frees its networks and keeps its data volumes. Review the Docker context before doing this. Leave active projects alone.

## B15A verification record

- The clean build produced Nginx, API/worker, migration, PostgreSQL and Mailpit images. PostgreSQL 18.7, Mailpit, the API, worker and Nginx reached healthy status. The migrator exited with code 0. Browser access was limited to the loopback proxy.
- All ten migrations applied to a fresh database. A separate B12-style database with nine migrations and historical fixtures upgraded successfully. Its preservation checks passed and Prisma detected no drift in either schema.
- Playwright Chromium exercised 44 route views at each of 390 and 1440 px through Nginx. A focused smoke was used after the image-only patches. The checks included administrator setup and access, quote intake, CRM, issuance, private download, local quote mail, contracts, renewal drafts, a due reminder, policy and supporting documents, and CSV import/export.
- After force-recreation, database record counts stayed the same and all six stored PDFs still matched their database SHA-256 digests. The backup preserved the same files and records in an isolated recovery project. The application verified 15,559 PDF bytes. The restore guard rejected both a changed manifest member and a repeat into the populated target.
- The host-side check passed 12 unit tests and 72 integration tests. Frontend and backend type checks, lint and builds passed. Actionlint passed on the unchanged workflows. Backend, frontend and browser npm audits reported zero advisories. The patched staging images were scanned separately with Trivy. See [image findings](39-DOCKER-INFRASTRUCTURE-GUIDE.md#image-security-audit). Hosted execution of B15A remains pending.
