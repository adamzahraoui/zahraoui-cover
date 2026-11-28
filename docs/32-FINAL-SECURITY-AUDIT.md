# 32 — Final security audit

B14 started from clean commit `16d1bb5`. The review covered Express route registrations and middleware, Prisma models and migrations, React rendering, environment gates, Compose, and existing regression tests. Checks used isolated synthetic records and loopback services. The [test report](36-FINAL-TEST-REPORT.md) records executed coverage.

## Findings register

| ID | Component | Severity | Evidence and impact | Remediation | Status and retest | Remaining risk |
| --- | --- | --- | --- | --- | --- | --- |
| B14-01 | ESLint dependency graph | Medium | Both lockfiles resolved the reported minimatch advisory through the TypeScript ESLint toolchain. Crafted glob patterns can exhaust resources in that toolchain. | Moved both TypeScript ESLint packages to 8.74.0 within the existing major. | Fixed. npm audit cleared the seven affected entries in each repo. Lint, type checks and builds reran. | Keep lockfile auditing in release checks. |
| B14-02 | Prisma dependency graph | High | npm reports two upstream advisories and two inherited high entries in the Prisma configuration chain. Affects schema/configuration tooling. | Scope patched transitive dependencies to Prisma config 6.19.3 and validate its CLI and runtime package graph. | Fixed in the current lockfile. Both dependency audit and production-only audit report zero. | Remove the temporary overrides when upgrading to an upstream Prisma release with patched dependencies. |
| B14-03 | Mail maintenance | Medium | A `PENDING` mail job already at the attempt cap had no lease and could stay queued indefinitely. | Terminally fail exhausted pending jobs. Keep active leases and reclaimable expired attempts eligible under the existing rules. | Fixed. Integration covered exhausted pending, expired recoverable leases, and concurrent claims. | SMTP acceptance just before process failure can cause duplicate emails on retry. |
| B14-04 | Web response routing | Medium | The bare SPA host returned its HTML for unknown public routes. It had no runtime indexing approval gate or page CSP. | Added an optional same-origin built-site host, public HTTP 404s, an explicit production indexing gate and restrictive response headers. | Fixed in the application host. Integration covered metadata escaping, noindex, header and cache behavior, and product visibility. | Production TLS and proxy do not have deployed verification. |
| B14-05 | Uploaded files | High | PDF type, signature, size, storage key and digest checks cover file handling. Malware screening infrastructure is absent. | Keep uploads production-disabled pending quarantine, malware screening and approved retention. | Open and gated. Production rejection, authorized attachment downloads and integrity checks are covered by integration tests. | A shared development or staging environment must use synthetic uploads only. |
| B14-06 | Backup operations | High | The database and private volume must be restored as a matched set. No approved production storage, operator targets or hosting setup are in place. | Provision encrypted offsite copies, verify integrity and rehearse recovery with the operator. | A local isolated restore verified document relations and bytes. Deployment signoff remains open. | Local drill timings cannot predict actual RPO or RTO. |
| B14-07 | Browser UI | Medium | The mobile public header overflowed with a longer agency name. Lighthouse flagged catalog heading order, visible control names and layout shift. | Allow the name to wrap, retain the mobile controls, align card semantics and reserve catalog results space. | Implemented. See the browser and Lighthouse results. | Long production copy and assistive technology still need review. |

No Critical finding was confirmed in the checked scope. Gitleaks 8.30.0 reported zero detections in ten accessible Git commits and the tracked baseline tree. Path screening and ignore-file review covered dotenv, credential files, key material, spreadsheet/PDF extensions and common backup paths. The expected placeholder `backend/.env.example` was tracked. A second scan of the B14 working files, including the new workflows, also reported zero detections. The original ignored Stitch archive was integrity-checked separately. Scans cannot establish the contents of inaccessible history, external systems, or undocumented secret formats.

## Dependency evidence

| Advisory or inherited entry | B14 version / affected range | Use and reachability | Fix and compatibility |
| --- | --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch, Moderate | Nested 10.2.6 before / 7.0.0–11.0.0 per npm | Development lint glob processing. The application did not route public input to this tool. | Both installations updated within TypeScript ESLint major 8 and cleared the advisory. |
| Inherited TypeScript ESLint toolchain, Moderate | 8.71.2 before / umbrella `typescript-eslint` ≤8.72.2. npm flags `@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}` 6.16.0–8.72.2 | Development only. Transitive minimatch graph. | 8.74.0 in both repos, with lint and build verification. |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), deepmerge-ts, High | 7.1.5 / <8.0.0 | Stack exhaustion in recursive merges. It arrives through Prisma config tooling. The app uses Zod for HTTP input and does not feed request JSON to Prisma config. | Upstream fix starts at 8.0.0. The CI follow-up pins 8.0.2 under Prisma config only. |
| [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw), effect, High | 3.21.0 / ≤3.22.0 | Potential event-loop exhaustion in affected template schema decoding. Same config dependency chain. No application route was found using Effect template schemas. | The CI follow-up pins fixed 3.22.1 under Prisma config only. |
| Inherited `@prisma/config` and `prisma`, High | Both 6.19.3. npm flags config ≥6.13.0-dev.1 and CLI 6.13.0-dev.1–7.10.0 or 7.11.0-dev.1–8.1.0-dev.4 | Schema configuration, migrations and deployment tooling. Runtime reachability and image composition have separate evidence requirements. | npm suggested 7.10.1, which still reports Effect and two inherited high entries. The scoped overrides clear the affected paths while retaining the existing Prisma and client versions. |

At B14, audit counts fell from 11 to four on the backend and seven to zero on the frontend. The CI follow-up reduced the backend count from four to zero.

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

## CI follow-up dependency remediation

The hosted backend audit on `47438fb` confirmed four high entries. The Prisma CLI and its config package were counted because their locked dependencies were vulnerable. A production-only clean install confirmed the same chain could be installed through the optional Prisma peer of `@prisma/client`.

The backend now pins `deepmerge-ts` 8.0.2 and Effect 3.22.1 only under `@prisma/config@6.19.3`. Prisma 6.19.3 loads the named `deepmerge` export for application config loading through c12. The export is retained. The major's changes include nested Map merging and mutation behavior. This repository uses the standard schema and environment config, and a separate explicit config-file validation exercised that loader after the upgrade. Prisma validation, generation, migration deployment and drift checks also passed. [Deepmerge-ts 8.0.0 release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)

Full and production-only audits returned zero with the overrides installed. This replaces the vulnerable versions and preserves the same audit threshold. Review and remove the overrides when the upstream Prisma graph includes both patches. The Prisma 7.10.1 candidate audited during B14 still included a vulnerable Effect version and would require client and PostgreSQL adapter changes. [Prisma upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
