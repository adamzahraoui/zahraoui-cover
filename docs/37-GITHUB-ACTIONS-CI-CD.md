# 37 — GitHub Actions verification

The workflows run on pushes and pull requests and can be dispatched manually. Security also has a weekly schedule. These workflows build and test. They do not deploy or use production credentials.

| Workflow | Jobs and evidence |
| --- | --- |
| [CI](../.github/workflows/ci.yml) | Installs locked frontend and backend packages. Type checks, ESLint and production builds run in both. The backend job starts isolated PostgreSQL and Mailpit, validates Prisma, applies the migrations, checks schema drift, then runs unit and integration tests. |
| [Security](../.github/workflows/security.yml) | Audits the frontend, backend and browser runner lockfiles independently. Gitleaks scans Git history and an archive of the checked-out tree with redacted results and no container network access. High and critical dependencies fail the affected audit job. |
| [Browser regression](../.github/workflows/e2e.yml) | Starts isolated PostgreSQL and Mailpit, migrates and seeds synthetic data, builds both apps, installs locked Playwright/axe tooling and runs the browser matrix. The frontend build uses production mode. The browser runner and API keep test mode. The browser runner can use local Chrome or Playwright Chromium. |

The hosted jobs use Node 24.18.0, read-only contents permissions, commit-pinned checkout/setup actions, disabled checkout credential persistence and explicit job timeouts. Compose services bind to loopback with disposable database names and credentials. The jobs generate distinct test keys on the runner and mask the generated values in step logs. The agency integration fixture supplies its own idempotency key so it can exercise published privacy notices with the backend CI environment. The browser runner checks the test database suffix, loopback endpoints and disabled indexing before seeding. No PDF or email captures are uploaded.

## Reproduce locally

Follow the [backend setup](../backend/README.md) and use a separate Compose project, a loopback database ending in `_test`, loopback Mailpit and synthetic notice wording. Migrate and seed the database. Build frontend and backend, install the browser toolchain and run the test with the same environment names as the workflow.

```sh
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix e2e ci
(cd e2e && npx playwright install chromium)
npm --prefix e2e test
actionlint
```

Set `FRONTEND_DIST_DIR` to the absolute frontend build directory and `QUOTE_PDF_DIR` to a dedicated temporary directory outside the workspace. Set `PUBLIC_ORIGIN` to a loopback address with the same port as the server. The browser runner uses `MAILPIT_ORIGIN` for the loopback Mailpit HTTP endpoint and can optionally select a local Chrome binary with `CHROME_EXECUTABLE`. It starts and shuts down its API and worker, leaving the disposable Compose services under the caller's control.

## First hosted runs

| Run at `47438fb` | Result and cause |
| --- | --- |
| [CI](https://github.com/adamzahraoui/zahraoui-cover/actions/runs/46140840282) | The frontend passed. The backend passed setup, Prisma migration and drift checks, build, lint, type checks and all 11 unit tests. Two of 72 integration tests failed. The agency app fixture inherited its intake idempotency key from the local B14 environment. GitHub CI omitted the key, so the contact submission returned 503. The next test read the missing notice result. The fixture now generates the key itself. |
| [Security](https://github.com/adamzahraoui/zahraoui-cover/actions/runs/46140840260) | Secret scanning and frontend/browser dependency audits passed. Backend npm audit reported two high transitive advisories and two inherited high entries through Prisma. Scoped overrides resolve the affected versions and the high-severity gate remains enforced. |
| [Browser regression](https://github.com/adamzahraoui/zahraoui-cover/actions/runs/46140840307) | Passed. The job ran all 44 route views at each of 390, 768, 1024 and 1440 px using Playwright Chromium. The hosted build inherited test mode from the job. The follow-up sets production mode on the frontend build step while preserving the API and browser test gates. |

GitHub used Ubuntu 24.04, Node 24.18.0, npm 11.16.0 and healthy PostgreSQL and Mailpit containers. Local B14 used Fedora, the same Node and npm versions, and separate loopback ports for the same Compose services. The relevant mismatch was the integration fixture's inherited key. A clean local rerun with the CI environment and no exported idempotency key passed all 11 unit tests and 72 integration tests. The production bundle passed the complete local Playwright Chromium matrix at all four widths. Actionlint 1.7.12 validated all workflow files after the fixes. Hosted verification of the follow-up changes is pending. [Security advisory details](32-FINAL-SECURITY-AUDIT.md)
