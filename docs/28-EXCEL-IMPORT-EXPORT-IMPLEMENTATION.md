# 28 — Excel and CSV import and export

Administrators open **Import / Export** from the staff sidebar. The page uses the existing admin layout, controls and responsive record lists. The three sections cover import, export and history.

## Run an import

1. **Choose and upload.** Choose Clients, Compagnies partenaires or Contrats existants. Download the XLSX or CSV template if needed. Upload a file containing column headers in its first row. For XLSX, choose the worksheet you intend to import.
2. **Map the columns.** Each source header is listed once. Match it to one approved destination or ignore it. Unambiguous French aliases, such as “Mobile” for “Téléphone,” are suggested. Competing source columns stay unassigned. Required destinations must be selected.
3. **Preview.** The server returns a dry run with total rows, proposed creations, invalid rows and duplicate conflicts. It writes only the import job and audit. Download the error report for row numbers, error codes and affected fields. Correct errors in the source and upload the corrected file again.
4. **Confirm.** Check the confirmation box and submit. The server rechecks the source digest, mapping, version, current administrator role, duplicate rules and resolved relationships. If the reviewed result changed, validate again. The transaction commits all proposed creations, or rolls them all back. Invalid rows block confirmation. Reviewed duplicates are counted as skipped. The successful report has the identifier, administrator, timestamp and links to created records.

See the [legacy data migration guide](29-LEGACY-DATA-MIGRATION-GUIDE.md) for columns, examples and the recommended import order.

## Limits and format rules

| Item | Limit or rule |
| --- | --- |
| Upload | 2 MiB, UTF-8 CSV or plain XLSX. CSV accepts comma or semicolon with quoted values. |
| Workbook | Up to 8 worksheets, 500 data rows plus the header per worksheet, 32 columns, 3,000 characters per cell, up to 40 ZIP entries and 8 MiB of expanded content. |
| Rates | 90 combined upload, validate and confirm requests per administrator per 15 minutes. Templates allow 60 requests and exports and error reports share 30 requests in the same interval. |
| Export | Up to 2,000 matching records per download. Narrow the filters for larger selections. |
| Preview retention | 30 minutes from upload. The worker clears expired row diagnostics. Reports retain non-sensitive counts, mapping, record IDs and audit information according to the approved operator policy. |

Phones and identifiers must be text in XLSX to preserve leading zeros. Plain text identifiers and accented data also survive UTF-8 CSV parsing. Dates may be ISO dates, unambiguous French `JJ/MM/AAAA` or Excel date cells using either supported date system. Use ISO when a slash date could mean two different dates. An insurance term expires at the start of its recorded end date in Africa/Casablanca. Positive premiums use the same fixed-precision MAD validator as manually registered policies.

The server checks extension and content separately. It validates ZIP entry names, types and decompressed size before allowing only supported XML parts into the XLSX reader. Macros, embedded objects, encrypted packages, external links and worksheet formulas are rejected. The server performs no external fetches or formula evaluation. Production imports are disabled. File inspection is a format and resource check, with approved malware scanning and data handling still required before real imports.

## Records, duplicates and recovery

- Customers are created as provisional CRM records. Phone and email collisions use the existing CRM duplicate check. The importer never uses contact details to merge or link records.
- Partners go through existing B10 validation and are stored as inactive, unpublished and unverified. Review and activate them separately.
- External policies reuse B9 draft registration. The customer and carrier are resolved by UUID or exact legacy reference. A missing, archived or ambiguous customer, or a carrier that is unverified, inactive or outside the category, blocks the row. No quote, policy activation, email or renewal job is created. Reminder scheduling is off on imported drafts until staff review.
- Duplicate input rows are flagged together. Existing legacy references, overlapping customer contact details, partner legal names and carrier/policy-number pairs are checked. A previously completed file SHA-256 shows a notice. Each row is still evaluated. Confirmation is serialized, and retrying an identical committed request returns its original receipt.

The additive migration `20261127070000_spreadsheet_imports` adds nullable, unique legacy references to customers, partners and contracts. It adds one `import_jobs` table for administrator, file digest, import type, version, timestamps, column indexes, counts, temporary error codes and created record IDs. No uploaded file, filename or customer cell value is persisted in history. The same file is sent again for validation and confirmation and handled in bounded memory. Closing or refreshing the wizard loses the selected file, and a fresh upload starts a new attempt. Completed reports remain available after refresh. Each administrator can access their own history.

## Export

Export customers, partners, contracts, quote requests and issued quotes as XLSX or CSV. The API shares the existing list filter definitions and generates the file from an explicit allowlist. It includes export time in UTC. Customer exports include operational contact fields. Quote-request and issued-quote exports exclude customer contacts and free-text contents. Issued quote exports exclude draft offers. Files use `Cache-Control: no-store` and exports are audited with dataset, format and count. XLSX cells use explicit text values. CSV quotes fields and prefixes values that could be interpreted as formulas. Prefer XLSX for reimport because CSV protection can add a leading apostrophe to values such as international phone numbers.

## API

All endpoints require a valid administrator session. The POST routes also require the session CSRF token and trusted origin. Imports are available in local and test environments.

| Method and path | Request and result |
| --- | --- |
| `GET /api/admin/imports/templates/:type` | Type is CLIENTS, PARTNERS or CONTRACTS. `format=xlsx\|csv`. Downloads a blank template with French headings. |
| `POST /api/admin/imports?kind=…&format=…` | Raw XLSX or CSV body and percent-encoded basename in `X-Import-Filename`. Returns 201 with job, worksheet headers, destination fields and suggested mappings. |
| `POST /api/admin/imports/:id/validate?version=…` | Original file plus percent-encoded JSON `X-Import-Selection` containing zero-based `sheet` and an indexed `mapping` of field keys or nulls. Returns the dry-run report and new version. |
| `POST /api/admin/imports/:id/confirm?version=…&confirmed=true` | Original file and explicit confirmation. Returns the committed, idempotent receipt. |
| `GET /api/admin/imports` | Paged administrator history using `page`, `limit` and optional `kind`. |
| `GET /api/admin/imports/:id` | History detail, counts and links to created business records. |
| `GET /api/admin/imports/:id/errors` | Downloads a CSV of row numbers and codes during the preview retention period. |
| `GET /api/admin/exports/:type` | Type is CLIENTS, PARTNERS, CONTRACTS, QUOTE_REQUESTS or ISSUED_QUOTES. `format=xlsx\|csv` plus the corresponding list filters without pagination. |

See [ImportWizard.tsx](../frontend/src/pages/admin/ImportExport/ImportWizard.tsx), [ExportForm.tsx](../frontend/src/pages/admin/ImportExport/ExportForm.tsx), [import routes](../backend/src/modules/imports/routes.ts) and [export routes](../backend/src/modules/imports/exports.ts).

## Dependency and release notes

The backend uses the pinned `read-excel-file`, `write-excel-file`, `yauzl`, `fflate` and `csv-parse` packages. The XLSX reader receives a bounded, rebuilt ZIP containing the reviewed entries. ExcelJS 4.4.0 was evaluated and left out after reviewing its published memory-exhaustion advisory. Comparing `npm audit` with the B11 lockfile found the same existing Prisma and lint advisory set. [ExcelJS advisory](https://github.com/advisories/ghsa-5pwm-xv7w-v3cm) · [XLSX reader](https://github.com/catamphetamine/read-excel-file) · [XLSX writer](https://github.com/catamphetamine/write-excel-file) · [ZIP reader](https://github.com/thejoshwolfe/yauzl) · [CSV parser limits](https://csv.js.org/parse/options/max_record_size/)

No historical agency workbook was supplied. Compatibility with the agency’s actual headers, identifiers, formats and date conventions still needs review. No real data was used for development or verification.

## Verification

Frontend and backend TypeScript, ESLint and production builds passed. All 11 unit tests and 61 PostgreSQL integration tests passed, including the 6 existing unit cases and 53 existing integration cases. The isolated fresh installation and B11 upgrade passed Prisma schema comparison. The upgrade preserved existing customer, partner, policy and historical PDF metadata links.

Chrome exercised the four-step wizard at **390, 768, 1024 and 1440 px** using synthetic data. The runs downloaded templates, corrected invalid rows, created provisional clients and inactive partners, verified partners separately, registered draft policies, downloaded filtered exports and refreshed history. Advisor and anonymous requests were denied. No import generated an email, outbox job or renewal reminder.

The original Stitch archive passed integrity testing and retained SHA-256 `57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583`.
