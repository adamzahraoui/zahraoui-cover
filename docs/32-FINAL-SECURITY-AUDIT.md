# 32 — Final security audit

B14 started from clean commit `16d1bb5`. The review covered Express route registrations and middleware, Prisma models and migrations, React rendering, environment gates, Compose, and existing regression tests. Checks used isolated synthetic records and loopback services. The [test report](36-FINAL-TEST-REPORT.md) records executed coverage.

## Findings register

| ID | Component | Severity | Evidence and impact | Remediation | Status and retest | Remaining risk |
| --- | --- | --- | --- | --- | --- | --- |
| B14-01 | ESLint dependency graph | Medium | Both lockfiles resolved the reported minimatch advisory through the TypeScript ESLint toolchain. Crafted glob patterns can exhaust resources in that toolchain. | Moved both TypeScript ESLint packages to 8.74.0 within the existing major. | Fixed. npm audit cleared the seven affected entries in each repo. Lint, type checks and builds reran. | Keep lockfile auditing in release checks. |
| B14-02 | Prisma dependency graph | High | npm reports two upstream advisories and two inherited high entries in the Prisma configuration chain. Affects schema/configuration tooling. | Plan and test the supported Prisma upgrade with migration and worker parity. Inspect the runtime image dependency inventory. | Open. Four high entries remained after the compatible dependency update. | Production image packaging and Prisma major upgrade remain unverified. |
| B14-03 | Mail maintenance | Medium | A `PENDING` mail job already at the attempt cap had no lease and could stay queued indefinitely. | Terminally fail exhausted pending jobs. Keep active leases and reclaimable expired attempts eligible under the existing rules. | Fixed. Integration covered exhausted pending, expired recoverable leases, and concurrent claims. | SMTP acceptance just before process failure can cause duplicate emails on retry. |
| B14-04 | Web response routing | Medium | The bare SPA host returned its HTML for unknown public routes. It had no runtime indexing approval gate or page CSP. | Added an optional same-origin built-site host, public HTTP 404s, an explicit production indexing gate and restrictive response headers. | Fixed in the application host. Integration covered metadata escaping, noindex, header and cache behavior, and product visibility. | Production TLS and proxy do not have deployed verification. |
| B14-05 | Uploaded files | High | PDF type, signature, size, storage key and digest checks cover file handling. Malware screening infrastructure is absent. | Keep uploads production-disabled pending quarantine, malware screening and approved retention. | Open and gated. Production rejection, authorized attachment downloads and integrity checks are covered by integration tests. | A shared development or staging environment must use synthetic uploads only. |
| B14-06 | Backup operations | High | The database and private volume must be restored as a matched set. No approved production storage, operator targets or hosting setup are in place. | Provision encrypted offsite copies, verify integrity and rehearse recovery with the operator. | A local isolated restore verified document relations and bytes. Deployment signoff remains open. | Local drill timings cannot predict actual RPO or RTO. |
| B14-07 | Browser UI | Medium | The mobile public header overflowed with a longer agency name. Lighthouse flagged catalog heading order, visible control names and layout shift. | Allow the name to wrap, retain the mobile controls, align card semantics and reserve catalog results space. | Implemented. See the browser and Lighthouse results. | Long production copy and assistive technology still need review. |

No Critical finding was confirmed in the checked scope. Gitleaks 8.30.0 reported zero detections in ten accessible Git commits and the tracked baseline tree. Path screening and ignore-file review covered dotenv, credential files, key material, spreadsheet/PDF extensions and common backup paths. The expected placeholder `backend/.env.example` was tracked. A second scan of the B14 working files, including the new workflows, also reported zero detections. The original ignored Stitch archive was integrity-checked separately. Scans cannot establish the contents of inaccessible history, external systems, or undocumented secret formats.

## Dependency evidence

| Advisory or inherited entry | Observed version / affected range | Use and reachability | Fix and compatibility |
| --- | --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch, Moderate | Nested 10.2.6 before / 7.0.0–11.0.0 per npm | Development lint glob processing. The application did not route public input to this tool. | Both installations updated within TypeScript ESLint major 8 and cleared the advisory. |
| Inherited TypeScript ESLint toolchain, Moderate | 8.71.2 before / umbrella `typescript-eslint` ≤8.72.2. npm flags `@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}` 6.16.0–8.72.2 | Development only. Transitive minimatch graph. | 8.74.0 in both repos, with lint and build verification. |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), deepmerge-ts, High | 7.1.5 / <8.0.0 | Stack exhaustion in recursive merges. It arrives through Prisma config tooling. The app uses Zod for HTTP input and does not feed request JSON to Prisma config. | Upstream 8.0.0. A direct override crosses a major. Validate generated client, migrations, images and restore workflows using a supported Prisma upgrade. |
| [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw), effect, High | 3.21.0 / ≤3.22.0 | Potential event-loop exhaustion in affected template schema decoding. Same config dependency chain. No application route was found using Effect template schemas. | Upstream 3.22.1. Prisma pins Effect. Prefer a supported Prisma graph over an application-wide transitive override. |
| Inherited `@prisma/config` and `prisma`, High | Both 6.19.3. npm flags config ≥6.13.0-dev.1 and CLI 6.13.0-dev.1–7.10.0 or 7.11.0-dev.1–8.1.0-dev.4 | Schema configuration, migrations and deployment tooling. Runtime reachability and image composition have separate evidence requirements. | npm suggested 7.10.1. This candidate still reports Effect and two inherited high entries. Select a supported graph only after verifying both upstream advisories. |

Counts from `npm audit --json` on locked installations were backend 11 → 4 (high), frontend 7 → 0. These are registry results at audit time.

## Permission matrix

Paths use the `/api` prefix. The groups below cover the Express registrations. CSRF is checked on authenticated mutations. Explicit login, recovery and anonymous intake have origin/validation controls and operation-specific limits. `—` means access denied.

| Route group and operations | Anonymous | Advisor | Administrator |
| --- | --- | --- | --- |
| GET `/health`, `/health/live`, `/health/ready` | Yes | Yes | Yes |
| GET `/catalog[/:slug]`, `/agency`, `/partners` | Published data | Published data | Published data |
| GET `/{quotes,contact,assistance}/notice`, POST `/{quotes,contact,assistance}` | Yes, notice and limits apply | Same | Same |
| POST `/auth/{login,forgot-password,reset-password}` | Yes | Yes | Yes |
| GET `/auth/session`, POST `/auth/{logout,change-password}` | — | Own | Own |
| GET `/admin/dashboard`, `/admin/staff-options` | — | Yes | Yes |
| GET `/admin/catalog[/:id]`; POST collection, PATCH item | — | Read | Read/write |
| GET `/admin/quote-requests[/:id]`; PATCH item, POST item `/notes` | — | Yes | Yes |
| GET `/admin/clients[/:id]`; POST collection and `/duplicates`, PATCH item | — | Yes | Yes |
| POST `/admin/clients/:id/archive` | — | — | Yes |
| GET `/admin/assistance[/:id]` and item `/contract-options`; PATCH item, POST item `/notes` | — | Yes | Yes |
| GET `/admin/messages[/:id]`; PATCH item, POST item `/archive` | — | Yes | Yes |
| GET `/admin/quotes[/:id]` and `/partner-options`; POST collection, PATCH item | — | Yes | Yes |
| POST `/admin/quotes/:id/{issue,retry-pdf,send,decision,cancel,revision}` | — | — | Yes, with lifecycle gates |
| GET `/admin/partners[/:id]`; POST collection, PATCH item, POST item `/verify` | — | Read | Read/write |
| GET `/admin/contracts[/:id]`; POST collection and `/external`, PATCH item, POST item `/{renew,documents}` | — | Yes, with lifecycle/storage gates | Yes, same gates |
| POST `/admin/contracts/:id/status` | — | — | Yes |
| GET `/admin/documents[/:id]` and item `/download`; POST collection | — | Yes, authorized records/storage gates | Yes, same gates |
| POST `/admin/documents/:id/archive` | — | — | Yes, uploads only |
| GET `/admin/imports`, item, item `/errors`, `/templates/:type`; POST collection, item `/validate`, item `/confirm` | — | — | Yes, own jobs and environment gates |
| GET `/admin/exports/:type` | — | — | Yes, bounded field allowlists |
| GET `/admin/settings`, `/readiness`, `/content`; PATCH settings, `/notifications`, content item; POST content and item `/publish` | — | — | Yes |
| GET `/admin/staff[/:id]`; POST collection and item `/{invite,revoke-sessions}`, PATCH item | — | — | Yes |
| GET `/admin/access` | — | — | Yes |

Case and client activity is returned in protected record details. There is no public audit-history API. Advisors share the agency case workspace by design. The application does not implement per-advisor record ownership. Import ownership is enforced independently. Related IDs supplied to an operation are checked against their record state and relationship, such as the client and policy tied to an assistance case.

## Control review

- Authentication uses Argon2id with about 19 MiB memory, two passes and one lane. Login rotates the opaque random token, stores its keyed digest and rates attempts. Idle and absolute expiry, logout, password change and reset, role changes and deactivation are enforced server-side. HTTPS uses the `__Host-zc_session` cookie with Secure, HttpOnly, SameSite and a root path. Reset/setup tokens are expiring, stored by digest, single-use and mailed in a URL fragment. Recovery responses are generic. The last active administrator is protected transactionally. Existing and new integration tests exercise expired/revoked credentials, CSRF, roles and staff lifecycle.
- Database reads use Prisma query objects and bound SQL parameters. Strict schemas reject unknown mutation fields, and response allowlists keep session digests, private paths and internal settings out of public output. Version checks produce conflicts for stale writes. Dates representing business days use Casablanca rules and money uses PostgreSQL decimal columns and string serialization.
- React renders agency and legal copy as text. The hosted HTML metadata escapes dynamic values. Website links are validated and outbound mail reads only its configured transport. No wildcard CORS policy was added. Helmet, the page CSP and Permissions-Policy cover frames, MIME sniffing, referrers and unused browser capabilities. JSON bodies have a 32 KiB cap without compressed input. Sheet and PDF bodies have separate bounded parsers.
- Private files live outside frontend static assets. Generated filenames, safe opens, PDF header/size verification, digest checks, access checks and attachment headers guard file retrieval. Uploaded files remain gated. Imports bound input and archive expansion, reject formula cells, preserve string identifiers and sanitize spreadsheet exports. Confirmation is transactional and concurrent attempts cannot activate policies or send notifications.
- Worker leases, unique job keys, capped retry and integrity-checked attachments protect state transitions. Quote status changes only after local SMTP success. Synthetic Mailpit testing is separate from provider delivery or bounce handling.

A clean install using `npm ci --omit=dev --ignore-scripts` in a separate directory still contained Prisma 6.19.3, config 6.19.3, deepmerge-ts 7.1.5 and effect 3.21.0 via the optional Prisma peer of `@prisma/client`. The registry listed no newer Prisma 6 release at audit time. Production pruning alone therefore does not remove the advisory chain. The suggested Prisma 7.10.1 was tested only in a disposable lockfile. It pulled deepmerge-ts 8.0.2 and Effect 3.20.0, reducing the high count from four to three. The candidate audit then suggested downgrading Prisma to 6.12.0. Neither recommendation was applied to the workspace. A future upgrade needs validation of client generation, Node/runtime deployment, adapter and configuration requirements, all migrations, the worker, and the restored database before selecting an audited dependency graph. Prisma 7 also changes the generated client configuration and PostgreSQL driver adapter, including connection pool behavior. [Prisma upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) The Security workflow fails on high advisories.
