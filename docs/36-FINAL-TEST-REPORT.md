# 36 — Final test report

Audit target was the B13 baseline at `16d1bb5` and the B14 working tree. All database, browser and mail checks used isolated loopback services, temporary private storage and synthetic records. No production services or data were used.

## Command results

| Check | Commands or tool | Result |
| --- | --- | --- |
| Baseline build and tests | Frontend/backend `npm run typecheck`, `npm run lint`, `npm run build`; backend `npm test`, `npm run test:integration` | Passed. 11 unit, 68 integration. |
| Final build and tests | Same commands with backend Prisma client generated before checks | Passed. 11 unit, 72 integration. Four added cases cover web metadata, HTTP 404 and headers, direct permission/CSRF/revocation checks and worker leases. |
| Fresh database | `prisma validate`, `prisma migrate deploy`, then `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | Passed, ten migrations, no difference. B14 adds no migration. |
| B12 → B13 upgrade | Start from nine migrations, seed approved synthetic prior-schema rows, deploy B13, run preservation assertions and drift | Passed. Existing records preserved and no difference detected. |
| Database query plans | `EXPLAIN (ANALYZE, BUFFERS)` on active-client list and due-pending outbox read | Client archive/date/ID index used with a 26 KB sort and 0.315 ms execution. Outbox state/next attempt/ID index-only read at 0.087 ms, zero heap fetches. Synthetic fixture sizes do not characterize production throughput. |
| Dependencies | Scoped `npm audit` and clean `npm ci --omit=dev --ignore-scripts` inspection | Frontend and browser toolchain 0. B14 initially reported four high entries in the Prisma chain. Scoped transitive updates in the CI follow-up cleared the full and production-only backend audits. |
| Git secret review | Gitleaks 8.30.0 redacted scans | Zero detections in ten accessible commits, the tracked baseline and the final audit working files. |
| Settings and staff workflows | Chrome with the built same-origin host at 390, 768, 1024 and 1440 px | Passed public settings validation/publication, legal and privacy version history, historical quote PDF immutability, preferences after refresh, invitation via Mailpit, role changes and session revocation. No uncaught browser exceptions. |
| Accessibility/performance | Chrome Resource Timing, axe-core 4.11.1 and Lighthouse 13.6.0 | Five representative pages had zero axe violations for the selected tags. Final Lighthouse home and catalog each scored 100 performance, 100 accessibility and 63 SEO with deliberate noindex. See [measurements](33-PERFORMANCE-SEO-ACCESSIBILITY.md). |
| Backup and restore | `pg_dump -Fc`, `pg_restore --exit-on-error --no-owner`, archive and PDF checksum validation | Passed. Four restored quote PDFs totaling 11,302 bytes matched all document relations and digests. The restored database reported all ten migrations and no drift. See the [drill](35-BACKUP-AND-RECOVERY.md). |
| Workflow lint | `actionlint` 1.7.12 | Passed locally for all three workflow files. See the [hosted run details and CI fixes](37-GITHUB-ACTIONS-CI-CD.md). |
| Stitch archive | `unzip -tq stitch_zahraoui_cover_insurance_platform.zip`, `sha256sum stitch_zahraoui_cover_insurance_platform.zip` | ZIP integrity passed. SHA-256 unchanged, `57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583`. |

## Business integrity checks

The integration suite covers verified customer intake protection and idempotency, precise MAD totals, Casablanca date behavior, quote snapshots and immutable PDFs, partner eligibility, authorized document access, transactional import confirmation, and quote and contract status changes. Acceptance does not activate coverage. Confirmation and renewal gates preserve prior policy and document history. The suite covers disabled production features, retry failures and concurrent worker claims. The dashboard queries bounded recent records and fixed query groups. No per-table-row SQL pattern was identified in the inspected dashboard route. Aggregate scan costs and worker behavior under sustained load remain staging checks.

## Chrome route matrix

The checked-in browser suite passed locally with Chrome 157.0.8103.78 at **390, 768, 1024 and 1440 px**. Each width covered 19 public views, three authentication routes and 22 authenticated administration views, or **176 route visits** in the matrix. Counts include the public and admin unknown-path fallbacks and the admin root redirect. No page-level horizontal overflow, uncaught exceptions or CSP violations were reported by the suite.

Each width submitted the four-step quote request, contact and assistance forms and checked persisted references. The signed-in browser covered CRM, partner verification/publication, quote issuance and PDF download, local quote delivery verified in Mailpit, acceptance, contract confirmation and a renewal draft. This combined route/UI and authenticated API checks. It also imported a CSV through the preview/confirmation UI, downloaded a CSV export, refreshed import history and confirmed idle expiry redirected back to sign-in. Separate settings/staff verification covered agency publication and legal editing and staff invitation/role workflows. Existing integration coverage includes XLSX, document upload and production rejection paths.

A separate four-width Chrome pass observed the catalog loading state, supplied one controlled service failure, retried against the real local API, applied the audience filter, and checked keyboard navigation and Escape. The inspected mobile menu buttons measured at least 44 × 44 CSS pixels. The route matrix also checked the skip link, reduced-motion media query and admin mobile menu focus behavior. Axe found zero violations for the selected WCAG tags on the dashboard, client list and settings at 390 and 1440 px. This sampled browser scope does not establish accessibility conformance.
