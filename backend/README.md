# Zahraoui Cover backend

Express 5 and TypeScript serve the API. Prisma 6 manages PostgreSQL, Zod validates requests and Argon2id hashes staff passwords. Authentication is connected to the existing React interface. The public catalog, quote request flow, staff request management, catalog administration, customer CRM, contact, assistance, issued quotes, contracts, renewals, partner management, centralized document management and the dashboard summary are live.

## Start locally

Use Node.js 22.12 or later, npm and Docker Compose.

1. From the workspace root, copy `backend/.env.example` to `backend/.env` and restrict permissions with `chmod 600 backend/.env`. Set a random `POSTGRES_PASSWORD` and three distinct random secrets. Run the command below separately for each value. Set `DATABASE_URL` to `postgresql://zahraoui_cover:YOUR_LOCAL_PASSWORD@127.0.0.1:5432/zahraoui_cover` using the values and port in the file. The hex output can be used without URL encoding.

   ```sh
   node -p "require('node:crypto').randomBytes(32).toString('hex')"
   ```

2. Start the loopback database and optional message sink from the workspace root.

   ```sh
   docker compose --env-file backend/.env --profile mail up -d --wait
   ```

3. Install and initialize the backend.

   ```sh
   cd backend
   npm ci
   npm run db:generate
   npm run db:validate
   npm run db:migrate
   npm run db:status
   npm run db:seed
   ```

   The seed adds six unpublished insurance categories. The migrations create the 18-table foundation and extend existing tables for catalog, CRM, support, issued quotes, contracts, renewals and partner verification. The seed is optional and has no effect on authentication.

4. Run `npm run dev` and `npm run worker:dev` in separate terminals in `backend/`. Run `npm ci` and `npm run dev` in `frontend/`. Use **http://localhost:5173/admin/login** to match the saved `PUBLIC_ORIGIN`. Vite forwards `/api` to port 3000. For a custom API port, set `API_PROXY_TARGET` in the frontend environment. For any change to the browser host, port or scheme, update `PUBLIC_ORIGIN` in the backend environment.

5. Run `npm run admin:create` in another backend terminal. Enter the professional email and display name at the prompts. Open the setup message in **http://127.0.0.1:8025**, follow the short-lived link and choose a password. Local Mailpit captures mail inside the development environment. Use synthetic addresses for development. The application sends email externally only with a configured TLS SMTP provider and running worker.

6. To test quote intake locally, set `PRIVACY_NOTICE_VERSION`, `QUOTE_NOTICE_TEXT` and a fourth distinct 32-byte hex secret in `IDEMPOTENCY_KEY_SECRET`, then restart the API. In **Catalogue des assurances**, add synthetic text to a reserved category and explicitly publish it. To capture acknowledgements, set `QUOTE_ACK_EMAIL=true`. To capture an agency notification, set `INTAKE_NOTIFY_EMAIL` to a synthetic `example.invalid` recipient. Restart the worker after mail configuration changes.

7. For local contact and assistance, add separate synthetic `CONTACT_NOTICE_TEXT` and `ASSISTANCE_NOTICE_TEXT` values under the same `PRIVACY_NOTICE_VERSION`. Set `CONTACT_ACK_EMAIL=true` to test contact acknowledgements. The configured `INTAKE_NOTIFY_EMAIL` receives internal alerts from all enabled forms.

8. For B8 quote testing, create a private directory outside the repository, set its absolute path in `QUOTE_PDF_DIR` and run the existing worker. In a disposable local test database, create a synthetic provider in **Partenaires** using an administrator account. Assign its test category, record an evidence reference, verify it and activate it. The seed leaves the partner list empty. Keep test PDF delivery on loopback Mailpit and verify the synthetic CRM email before sending. [Partner management](../docs/26-PARTNER-MANAGEMENT-IMPLEMENTATION.md) · [Issued quotes](../docs/22-ISSUED-QUOTES-IMPLEMENTATION.md) · [PDF and delivery](../docs/23-PDF-AND-DELIVERY-IMPLEMENTATION.md)

9. For local B9 testing, use the same private PDF directory and worker. Set `RENEWAL_NOTIFY_EMAIL` to a synthetic internal address and optionally set `RENEWAL_REMINDER_DAYS` (default `30,15,7,1`). Start Mailpit and use synthetic insurer confirmation and PDF documents. Confirm a contract with a near-term end date to test a due reminder. [Contracts](../docs/24-CONTRACTS-IMPLEMENTATION.md) · [Renewals](../docs/25-RENEWALS-AND-REMINDERS-IMPLEMENTATION.md)

The **Documents** menu lists private files and allows local PDF uploads when the configured private directory is available. The worker and API use the same directory. [Document management](../docs/27-DOCUMENT-MANAGEMENT-IMPLEMENTATION.md)

For B12, open **Import / Export** as an administrator in local development. Use the bundled templates and synthetic data. The API receives spreadsheet bytes in memory and records preview or import history in PostgreSQL. [Spreadsheet implementation](../docs/28-EXCEL-IMPORT-EXPORT-IMPLEMENTATION.md)

B13 uses the existing Mailpit setup for staff invitations and managed local notifications. See the [staff guide](../docs/31-STAFF-ADMINISTRATION-GUIDE.md) and [agency settings](../docs/30-AGENCY-SETTINGS-IMPLEMENTATION.md).

The public probe is `GET /api/health`. From the API machine, check database readiness using `GET /api/health/ready`. The first-admin command operates once per database. For a missing or expired setup link, request a new one from the password recovery page.

## Checks and production build

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

Run integration tests with `npm run test:integration` after setting up a **separate local database** with a name ending in `_test`. The runner requires `NODE_ENV=test` and `TEST_DATABASE_URL`. It optionally loads `backend/.env.test`. Copy the development settings into that file and use a distinct Compose project, password, database, ports and secrets. Set both database URLs there to the dedicated test instance, configure `SMTP_MODE=local`, and apply migrations before running tests.

```sh
# From the workspace root, after configuring backend/.env.test
docker compose -p zahraoui-cover-tests --env-file backend/.env.test up -d --wait
cd backend
node --env-file=.env.test node_modules/prisma/build/index.js migrate deploy
npm run test:integration
```

The tests use synthetic records and never truncate the database. Stop the Compose services using the same project and environment settings. The named PostgreSQL volume persists between starts.

`npm start` and `npm run worker:start` run the compiled programs. Production deployment still needs a same-origin HTTPS reverse proxy, private PostgreSQL and least-privilege database roles, an approved SMTP sender and monitoring. `SMTP_MODE=tls` uses implicit TLS (commonly port 465). `SMTP_MODE=starttls` requires a verified STARTTLS upgrade. Configure trusted proxy hops only when the backend is reachable solely through that configured proxy topology.

See the [implementation report](../docs/16-BACKEND-IMPLEMENTATION.md) and the [beginner guide](../docs/17-BACKEND-BEGINNER-GUIDE.md). See also [Live catalog](../docs/18-INSURANCE-CATALOG-IMPLEMENTATION.md), [Quote requests](../docs/19-QUOTE-REQUEST-IMPLEMENTATION.md), [Customer CRM](../docs/20-CUSTOMER-CRM-IMPLEMENTATION.md) and [Contact and assistance](../docs/21-CONTACT-ASSISTANCE-IMPLEMENTATION.md).
