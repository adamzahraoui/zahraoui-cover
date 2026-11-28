# 30 — Agency settings

Administrators open **Paramètres** in the staff sidebar. The page manages approved company details, legal texts, notification preferences and renewal intervals. It also shows staff administration, recorded activity and read-only production checks.

## Publish company information

The form starts with **Zahraoui Cover**, **+212 523 281 585** for the office and **+212 522 542 323** for assistance. Add optional company details only after approval. These can include legal name, registration and authorization references, city, address, opening hours, public email, WhatsApp and HTTPS site or social links. The form asks for explicit publication confirmation before saving. An empty optional field clears it. Existing singleton values remain private until an administrator approves their publication.

The server validates the email, phone numbers and HTTPS links, and rejects unknown fields or an outdated version. The approved fields appear across the header, footer, contact and assistance pages, insurance details, quote confirmation and About. If the public service is unavailable, the site keeps the bundled brand name and official numbers. Empty optional details are hidden.

The existing typographic brand identity stays in use while the standalone logo is pending. Logo keys can only refer to the controlled source manifest. There are currently no approved entries, and no image-upload controls.

## Draft and publish legal content

Choose the content type and save a draft. Reopen it to review or edit it, then explicitly publish the saved version. The public pages use published legal, privacy and cookie text. Approved proposal text goes into future quote snapshots. Approved notification text is appended to supported local business messages. Setup and password recovery retain their fixed security wording.

Each publication keeps its own UUID, editor version, publication time and publisher. The database rejects edits or deletion after publication. Create a new draft for the next version. Public privacy forms use the latest published UUID without hyphens as the notice version. Publishing a new version invalidates new submissions using the old version. Retrying a previously committed request still returns its original receipt.

For all new quote, contact and assistance submissions, the database records the exact notice text and version used for acknowledgement. Before an administrative privacy publication, each form can continue to use its approved environment-configured notice. The operator must advance the version whenever that text changes. Older acknowledgements keep their original version. Historical text that was only configured in the environment cannot be reconstructed by the migration.

## Notifications and renewal intervals

Configure an optional approved recipient per internal alert type, with separate toggles for quote and contact acknowledgements. Approved recipients and SMTP credentials are outside the public response. The worker rechecks preferences before sending queued jobs and preserves existing retry and deduplication behavior. Administration-managed recipients and wording apply to loopback test mail only. Existing environment-based behavior applies until managed preferences are saved. Settings do not authorize an external SMTP transport.

The default renewal schedule is **30, 15, 7 and 1 days** before expiry. Choose 1–12 distinct integers from 1 to 365. Renewal dates use the existing Africa/Casablanca calendar and 09:00 local delivery windows. Updating the recipient, enablement or offsets reconciles pending jobs in the same transaction. Removing an interval retires pending jobs for it. Restoring an eligible unsent interval can reactivate its deduplicated job. Delivered windows remain recorded and older windows are suppressed once a later reminder was sent. Cancelled, expired and superseded terms do not receive new jobs. If a renewal send currently holds a lease, the change asks the administrator to retry after it completes.

## Quote PDFs and readiness

Issuance freezes the approved company information and proposal wording in the quote snapshot. The PDF worker reads only that snapshot. Files issued before B13 keep their stored bytes and digests, and legacy snapshots remain readable. The PDF retains the development watermark and original production gate. Email wording changes affect future local sends, including an eligible queued send, while PDF contents remain frozen.

**Préparation à la production** shows published legal and privacy text, published categories, approved proposal wording and an approved logo if present. Published product counts and text publication reflect administrative actions. SMTP and HTTPS indicators only report the configured environment. They do not prove an operational relay or deployment. Malware scanning, durable storage, migration approval and a verified restore remain pending when there is no evidence available to the app. No indicator changes an environment gate.

## API

| Method and path | Access and behavior |
| --- | --- |
| `GET /api/agency` | Public approved fields and published legal, privacy and cookie content. Private recipients, quote and email wording, and audit details are excluded. |
| `GET /api/admin/settings` | Admin settings, current version, notification and reminder preferences, and recent activity. |
| `PATCH /api/admin/settings` | Admin, CSRF, current version, editable public fields and `approved: true`. |
| `PATCH /api/admin/settings/notifications` | Admin, CSRF, current version, complete notification preferences and reminder intervals. |
| `GET /api/admin/settings/content?kind=…` | Admin paginated draft and published history by `LEGAL`, `PRIVACY`, `COOKIES`, `QUOTE` or `EMAIL`. |
| `POST /api/admin/settings/content` | Admin, CSRF. Create a draft with kind and body. |
| `PATCH /api/admin/settings/content/:id` | Admin, CSRF. Update a draft body with the current version. |
| `POST /api/admin/settings/content/:id/publish` | Admin, CSRF. Publish an immutable version with the current version and `approved: true`. |
| `GET /api/admin/settings/readiness` | Admin, read-only configuration and verified application states. |

The public settings patch accepts `agencyName`, `legalName`, `officePhone`, `assistancePhone`, `email`, `address`, `city`, `hours`, `whatsappPhone`, `website`, `registration`, `authorization`, `socialLinks` and the controlled `brandAsset` key. Optional values can be null. The `socialLinks` object accepts only `facebook`, `instagram` and `linkedin`. Add the current `version` and `approved: true` when publishing.

The notifications patch accepts `version`, `reminderDays` and a `notifications` object. Its `quote`, `contact`, `assistance` and `renewal` entries each contain `enabled` and `recipient`. A recipient is mandatory when its alert is enabled. The two other keys are `quoteAcknowledgement` and `contactAcknowledgement`.

Invalid fields return 422, stale versions return 409, and protected actions require a current administrator session. Audit events record approved actions and field names, with private values kept on their protected records. See [Settings.tsx](../frontend/src/pages/admin/Settings/Settings.tsx), the [public provider](../frontend/src/config/CompanyProvider.tsx) and the [staff guide](31-STAFF-ADMINISTRATION-GUIDE.md).

## Migration and verification

Migration `20261128080000_agency_administration` extends the settings singleton, adds immutable published contents and adds nullable notice snapshots to the three intake tables. It initializes the known company name and numbers on fresh installations and preserves any existing singleton and data. See the [implementation status](15-IMPLEMENTATION-STATUS.md) for test results and remaining release requirements.

Both projects passed TypeScript, ESLint and production builds. All 11 unit and 68 integration tests passed. The B12 upgrade and fresh install reported no Prisma schema drift. Chrome exercised the connected settings, public pages, notice publication, invitation and revocation at 390, 768, 1024 and 1440 px. Poppler confirmed layout, official numbers, approved wording and the development watermark in a generated sample. The original Stitch ZIP retained SHA-256 `57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583`.
