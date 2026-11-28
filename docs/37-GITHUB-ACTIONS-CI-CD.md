# 37 — GitHub Actions verification

The workflows run on pushes and pull requests and can be dispatched manually. Security also has a weekly schedule. These workflows build and test. They do not deploy or use production credentials.

| Workflow | Jobs and evidence |
| --- | --- |
| [CI](../.github/workflows/ci.yml) | Installs locked frontend and backend packages. Type checks, ESLint and production builds run in both. The backend job starts isolated PostgreSQL and Mailpit, validates Prisma, applies the migrations, checks schema drift, then runs unit and integration tests. |
| [Security](../.github/workflows/security.yml) | Audits the frontend, backend and browser runner lockfiles independently. Gitleaks scans Git history and an archive of the checked-out tree with redacted results and no container network access. High and critical dependencies fail the affected audit job. |
| [Browser regression](../.github/workflows/e2e.yml) | Starts isolated PostgreSQL and Mailpit, migrates and seeds synthetic data, builds both apps, installs locked Playwright/axe tooling and runs the browser matrix. The browser runner can use local Chrome or Playwright Chromium. |

The hosted jobs use Node 24.18.0, read-only contents permissions, commit-pinned checkout/setup actions, disabled checkout credential persistence and explicit job timeouts. Compose services bind to loopback with disposable database names and credentials. The jobs generate distinct test keys on the runner. The browser runner checks the test database suffix, loopback endpoints and disabled indexing before seeding. No PDF or email captures are uploaded.

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

Actionlint 1.7.12 validated the three workflow files locally. The checked-in browser suite passed locally in Chrome at all four widths. GitHub has no confirmed execution for these working-tree changes. The local npm audit currently makes the backend Security job fail at the high threshold for the Prisma chain. The workflow deliberately preserves that signal. See [the advisory register](32-FINAL-SECURITY-AUDIT.md) for the investigation. [GitHub checkout](https://github.com/actions/checkout) · [GitHub Setup Node](https://github.com/actions/setup-node) · [Playwright CI guide](https://playwright.dev/docs/ci) · [Actionlint releases](https://github.com/rhysd/actionlint/releases)
