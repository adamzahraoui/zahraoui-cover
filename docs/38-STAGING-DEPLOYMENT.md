# 38 — Controlled staging deployment

This stack is for local or privately tunneled staging with synthetic records. The production frontend build is used. The API and worker use a restricted test environment with an internal SMTP sink. Regular local development remains governed by [docker-compose.yml](../docker-compose.yml) and the [backend setup](../backend/README.md).

## Prerequisites and setup

Use Docker with Compose v2, Git, OpenSSL and Python 3 for restore. Run the commands in the repository root. On a new checkout, make the private configuration file.

```bash
(umask 077; cp -n .env.staging.example .env.staging)
```

Generate six distinct values with `openssl rand -hex 32`. Fill the six blank keys in `.env.staging` using those values. The template documents the loopback port. This port must match the URL entered in the browser, because the API checks the request origin. Keep the file private. Compose can expand these secrets in configuration and container inspection output, so use `config --quiet` for validation and avoid sharing inspection output. Use a distinct file with new keys for an independent staging installation. Keep the database and reset key references for recoverable backups. Existing PostgreSQL passwords require an explicit database rotation procedure. Editing the environment file alone cannot rotate a database account on an existing volume.

```bash
docker compose --env-file .env.staging -f compose.staging.yml config --quiet
docker compose --env-file .env.staging -f compose.staging.yml build
docker compose --env-file .env.staging -f compose.staging.yml up -d --wait
docker compose --env-file .env.staging -f compose.staging.yml ps -a
```

Use [http://127.0.0.1:8088/](http://127.0.0.1:8088/). Change `STAGING_PORT` when a different local port is required. Verify that Nginx, API, worker, PostgreSQL and Mailpit are healthy. The migration container should show `Exited (0)`. Only the reverse proxy publishes a host port, bound to 127.0.0.1. Access requires a trusted local account or an authenticated tunnel to the host. The stack uses HTTP on that loopback connection.

Use the [runbook](40-OPERATIONS-RUNBOOK.md) to create the first administrator. Configure or create synthetic catalog entries in the admin UI before testing public intake. A clean database starts without business records.

## Future VPS and HTTPS

A starting budget for low-traffic staging is 4 vCPUs, 8 GiB RAM and 40 GiB SSD, with additional space based on PDF retention and backup size. Observe actual memory, database, disk and queue behavior under a representative test. Limit SSH access, isolate backup storage from the application host, and retain only loopback bindings on services that have a private entry point.

For a future HTTPS topology, provision a certificate for the approved hostname and terminate TLS at an authorized Nginx ingress. Restrict access in the firewall and at the ingress. Redirect HTTP to HTTPS after certificate verification, verify HSTS and secure session cookies and set the exact HTTPS `PUBLIC_ORIGIN`. Forward only normalized headers from the trusted hop. Review `TRUST_PROXY_HOPS` against the real chain before accepting traffic. Protect health endpoints and preserve the upstream response status and cache headers. This Compose file is specifically the loopback test stack. A VPS production release requires a separate reviewed configuration and the [production approvals](34-PRODUCTION-READINESS.md).

A future ingress configuration can start from this server block after substituting approved values and reviewing the hop settings. Use it with a separately configured HTTPS application environment. The current loopback staging mode rejects a public origin.

```nginx
server {
    listen 443 ssl;
    server_name APPROVED_HOSTNAME;
    ssl_certificate APPROVED_CERTIFICATE_PATH;
    ssl_certificate_key APPROVED_PRIVATE_KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:APPROVED_UPSTREAM_PORT;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Forwarded "";
    }
}
```

Apply ingress authentication, an HTTP redirect and HSTS only after the approved origin works over HTTPS. Test secure cookies, CSP, upload limits and error responses through the complete proxy chain.
