# Zahraoui Cover

Zahraoui Cover is a French-language insurance brokerage application with a React public site and staff console, an Express API, PostgreSQL, and a background worker.

- [Local development](backend/README.md) uses the existing `docker-compose.yml` for PostgreSQL and optional Mailpit. Run the backend, worker and Vite on the host.
- [Controlled Docker staging](docs/38-STAGING-DEPLOYMENT.md) runs the entire stack. It binds Nginx to loopback and uses synthetic records and internal Mailpit.
- [Implementation status](docs/15-IMPLEMENTATION-STATUS.md) records verification and open release requirements.

## Start controlled staging

Run the staging commands with `-f compose.staging.yml` and `--env-file .env.staging`. Plain `docker compose up` selects the development services, which require a separate PostgreSQL password.

Install Docker with Compose v2, Git, OpenSSL and Python 3 for restore operations. From the repository root, create the private environment file once.

```bash
(umask 077; cp -n .env.staging.example .env.staging)
```

Fill the six blank values in `.env.staging` with different outputs from `openssl rand -hex 32`. Keep the file private. Build and start the stack with the following commands.

```bash
docker compose --env-file .env.staging -f compose.staging.yml build
docker compose --env-file .env.staging -f compose.staging.yml up -d --wait
docker compose --env-file .env.staging -f compose.staging.yml ps -a
```

Open [the local staging site](http://127.0.0.1:8088/). Create the first administrator with a synthetic address ending in `.invalid`.

```bash
docker compose --env-file .env.staging -f compose.staging.yml exec backend node dist/src/modules/auth/create-admin.js
```

Follow the [operations runbook](docs/40-OPERATIONS-RUNBOOK.md#health-migrations-and-first-administrator) to retrieve the setup email from internal Mailpit and choose a password. Use the same runbook for backup and recovery.

The stop command retains the database and document volumes.

```bash
docker compose --env-file .env.staging -f compose.staging.yml stop
```

The original Stitch archive is excluded from Docker builds and remains unchanged.
