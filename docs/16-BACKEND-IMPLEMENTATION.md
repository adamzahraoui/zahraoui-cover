# 16 — Backend foundation implementation

The backend foundation and staff authentication use Express, TypeScript, Prisma, PostgreSQL, Zod and Argon2id. React calls the authentication API through the same origin. The public pages and business demos keep their existing UI and data sources. The original Stitch archive is unchanged.

## Files and responsibilities

| File or folder | Responsibility |
| --- | --- |
| [docker-compose.yml](../docker-compose.yml) | PostgreSQL 18 with a named volume, a health check and loopback-only port publishing. The optional mail profile starts a local Mailpit SMTP sink. |
| [Configuration](../backend/src/config/env.ts) and [.env.example](../backend/.env.example) | Read and validate environment settings, PostgreSQL URL, exact browser origin, three separate keys and SMTP mode. |
| [Prisma schema](../backend/prisma/schema.prisma), [migration](../backend/prisma/migrations/20261127000000_foundation/migration.sql) and [seed](../backend/prisma/seed.ts) | Database model, SQL constraints, indexes and revocation trigger. Seed upserts six unpublished demonstration categories and preserves existing edited content. |
| [Prisma client](../backend/src/database/prisma.ts), [app](../backend/src/app.ts) and [server](../backend/src/server.ts) | Build the API, connect to PostgreSQL, register middleware and routes, report health and release resources on shutdown. |
| [Request middleware](../backend/src/middleware/request.ts) and [error handler](../backend/src/middleware/errors.ts) | Request IDs, route-template logging, exact browser origin, Zod validation and structured redacted responses. |
| [Auth routes](../backend/src/modules/auth/routes.ts), [sessions](../backend/src/modules/auth/session.ts) and [request contracts](../backend/src/modules/auth/contracts.ts) | Login, read session, role checks, logout, password change and recovery. |
| [Limits](../backend/src/modules/auth/limits.ts), [audit](../backend/src/modules/auth/audit.ts) and [crypto](../backend/src/utils/crypto.ts) | Persist atomic rate buckets, write redacted auth audit events, hash passwords and tokens, derive session CSRF values, and encrypt queued reset tokens. |
| [Recovery](../backend/src/modules/auth/recovery.ts), [administrator command](../backend/src/modules/auth/create-admin.ts) and [mail worker](../backend/src/worker.ts) | Serialize recovery links per staff user, provision the first admin through an emailed setup link, and deliver reset messages from the outbox. |
| [Backend tests](../backend/tests) and [backend README](../backend/README.md) | Unit and local database integration tests, setup, provisioning and deployment commands. |
| [Vite proxy](../frontend/vite.config.ts), [frontend API client](../frontend/src/services/api.ts), [admin session provider](../frontend/src/components/admin/auth/AdminSession.tsx) and [admin routes](../frontend/src/pages/admin/AdminRoutes.tsx) | Same-origin requests, in-memory session display and CSRF state, redirects, async route protection and ADMIN-only settings access. |
| [Login](../frontend/src/pages/admin/Login/Login.tsx), [forgot password](../frontend/src/pages/admin/ForgotPassword/ForgotPassword.tsx), [reset](../frontend/src/pages/admin/ResetPassword/ResetPassword.tsx) and [change password](../frontend/src/components/admin/auth/ChangePasswordForm.tsx) | Connected French forms, genuine server outcomes and accessible pending/error feedback. The top bar displays the signed-in staff member and logout. |

## Database

PostgreSQL stores all 18 documented tables. Future business tables have schema only in this phase.

| Group | Tables |
| --- | --- |
| Auth and operations | staff_users, admin_sessions, password_reset_tokens, rate_limits, audit_events, outbox_jobs |
| Catalog and intake | insurance_products, clients, quote_requests, request_notes, assistance_cases, contact_messages, submission_keys |
| Future commercial administration | partners, quotes, contracts, documents, agency_settings |

The baseline uses one ordered migration on empty PostgreSQL 18 databases. The Prisma model maps readable TypeScript names to the SQL names in the architecture. Required fields, UUID/FK relationships, optional link behavior, unique keys and ordinary indexes are in Prisma. Named constraints, prefix indexes, the case-insensitive partner key, document revision partial indexes and credential-change revocation are in the SQL migration. The last item closes a gap in the logical auth model by making password, role and activation changes revoke credentials even when performed through a database operator workflow. Relationship rules that require business context remain for the modules that will write those records. [Prisma CHECK constraint guidance](https://www.prisma.io/docs/orm/v6/more/troubleshooting/check-constraints)

The database change policy is forward-only. Applying the migration again checks its recorded state. Development seed data uses reserved category slugs, includes no insurer or staff identity and stays unpublished. Operator verification used isolated databases and no existing database or volume was removed.

## Implemented HTTP surface

| Method and path | Access and result |
| --- | --- |
| GET /api/health | Public liveness, 200 {status: "ok"}. |
| GET /api/health/live | Internal liveness alias. |
| GET /api/health/ready | Internal DB and recorded migration readiness. Responds 503 {status: "unavailable"} if either check fails. |
| POST /api/auth/login | Public same-origin JSON with email/password. Returns Auth and the session cookie, or generic INVALID_CREDENTIALS. |
| GET /api/auth/session | Active staff cookie. Returns id, email, displayName, role, expiresAt and the session-bound CSRF value. |
| POST /api/auth/logout | Staff cookie, exact origin and CSRF. Revokes the session and clears the cookie with 204. |
| POST /api/auth/change-password | Staff cookie, exact origin and CSRF. Checks currentPassword and accepts newPassword, revokes all sessions and clears the cookie with 204. |
| POST /api/auth/forgot-password | Public same-origin JSON with email. Returns the same 202 for known, unknown, inactive or account-throttled requests. Queues eligible mail when configured. |
| POST /api/auth/reset-password | Public same-origin JSON with token/password. Accepts a valid link once, updates the hash and revokes sessions with 204. |
| GET /api/admin/access | ADMIN-only permission probe with no business data. Unknown admin API paths require an active staff session and then return 404. |

The response envelope follows the [API contracts](06-API-ENDPOINTS.md). Health responses and 204 are intentionally bare. The Vite proxy is a local development and preview dependency. Deploy the production SPA and API behind the same HTTPS origin and protect internal health paths at the edge.

## Implemented controls

- Argon2id uses 19 MiB memory, two iterations and parallelism one, with an automatic salt. Unknown and inactive accounts receive comparable password verification work and generic errors.
- Sessions use random 32-byte opaque values with SHA-256 digests in PostgreSQL, a 30-minute idle timeout and a 12-hour absolute lifetime. Login rotates the presented session. Logout revokes it. Password, role and activation changes revoke all existing sessions and outstanding reset links for the account.
- The HTTPS cookie is host-only, Secure, HttpOnly, SameSite=Lax and scoped to /. Loopback HTTP development uses a separate HttpOnly cookie name. The session token is never part of a JSON response. Auth responses set no-store.
- Unsafe requests require the exact configured origin or a matching Referer when Origin is absent. Authenticated writes additionally check the session CSRF value. This same-origin design omits cross-origin permission headers. Bodies are limited to 32 KiB and Zod rejects unexpected fields.
- PostgreSQL rate buckets use HMAC-protected identifiers. Login permits five failed or in-flight verifications per account and 20 calls per source per 15-minute window. Successful login releases its account reservation. Recovery limits are five per source and three per account per hour. Reset and password change are also bounded.
- Reset links expire after 30 minutes and are used atomically. Only digests persist with the token row. AES-256-GCM protects the encrypted mail payload until delivery, expiry, invalidation or terminal failure. The worker uses a lease, bounded retries and stable message identifiers. It also cleans expired rate buckets and past-retention auth records.
- Logs use correlation IDs and route templates without request bodies, cookies or email addresses. Audit rows record events and the staff ID when known. The browser removes reset fragments and keeps CSRF in memory.

## Verification results

| Check | Result |
| --- | --- |
| Compose and persistence | PostgreSQL 18 and loopback Mailpit passed their health checks. The test project used dedicated PostgreSQL databases and a named volume. |
| Prisma | Schema validation and client generation passed. Migration deployed to fresh databases. A second deploy reported no pending migrations and Prisma reported no schema difference. PostgreSQL-specific constraints and indexes were checked separately. |
| Seed | Two runs left six unpublished insurance categories. |
| Static checks | Backend and frontend TypeScript, ESLint and production builds passed. |
| Unit tests | 4 passed. Argon2id, token and CSRF derivation, reset encryption and production environment constraints. |
| API and database integration | 10 passed. Valid and invalid login, unknown user, rotation, idle/absolute expiry, unauthorized reads, role enforcement, rate-limit concurrency, CSRF, invalid payloads, logout, reset expiry/reuse, credential changes, migration constraints and database failure. |
| Browser | Chrome tested the compiled frontend through the Vite proxy and the compiled Express server. The CLI created a first admin without a password and Mailpit captured the setup link and a later recovery message. All 20 protected entries in the route test required sign-in. Refresh, expired session, role restrictions, password change and logout passed. |

The HTTPS cookie attributes were checked in an API test. Browser testing used local HTTP and Mailpit. External SMTP delivery and deployment behind a production TLS proxy remain unverified.

## Scope and release dependencies

The first admin command needs a configured worker and delivery method. In development, loopback Mailpit captures the messages. Production configuration still needs a verified sender, approved TLS SMTP relay, HTTPS reverse proxy, private database networking, least-privilege database roles, edge controls and operational alert routing. [Nodemailer SMTP transport](https://nodemailer.com/smtp.html)

The next phase owns the catalog API and real quote intake. Quote request management, clients, contact/assistance operations, dashboards, quotes, contracts, partners, settings persistence, document storage, PDFs, renewals and business notifications remain future modules. The frontend staff console clearly labels its fictional records and local edits. No invoice, medical or real customer data is introduced.
