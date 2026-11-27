# 26 — Insurance partner management

Zahraoui Cover records the insurers it has reviewed. In the staff console, **Partenaires** shows the legal name, optional display name, verification, activation, publication and supported categories. Search matches the start of either name without regard to case. Filters and pagination run on the server. Open a record to see private contact details, its recent activity and up to eight recent quotes and contracts each.

## Working with a partner

1. As an administrator, select **Ajouter une compagnie**. Enter the legal name and choose its insurance categories. The optional display name is used in new-offer selectors and on the public site. The optional contact fields are contact person, telephone, email, address and internal notes. If you enter a website, use an HTTPS URL without embedded credentials.
2. Save the draft. It starts unverified, inactive and unpublished. The legal name is unique regardless of case, and the server trims surrounding whitespace.
3. Confirm the insurer and its category scope using the agency's approved records. Open the partner and enter the verification reference, then choose **Vérifier la compagnie**. The API requires at least one category from the catalog and records who reviewed the partner and when.
4. Choose **Activer la compagnie** to allow new quotes and contracts in its approved categories. Choose **Publier sur le site** separately if the company should appear on the homepage. The homepage displays only the approved display name or legal name and the optional website. It hides the section when there are no published, eligible insurers.
5. Deactivating the company removes it from selectors and unpublishes it. Its verification can be reused for reactivation. After a change to its legal name, display name, website or category membership, verify the updated details again before reactivation and publication. Private contact and note changes keep the current approval.

Advisors can search and view records and histories. Creation, editing, verification and lifecycle changes require an administrator. See [partner list](../frontend/src/pages/admin/Partners/Partners.tsx), [partner editor](../frontend/src/pages/admin/Partners/PartnerEditor.tsx) and [homepage](../frontend/src/pages/public/Home/Home.tsx).

## API

| Method and path | Who can call it | Behavior |
| --- | --- | --- |
| `GET /api/partners` | Public | Returns `{data: [{name, website}]}` for verified, active, explicitly published records. The website may be null. |
| `GET /api/admin/partners` | Staff | Returns `{data, meta: {page, limit, total}}`. Supports `q`, `page`, `limit`, `status` (UNVERIFIED, VERIFIED, ACTIVE, INACTIVE or PUBLISHED), `active` (true or false), and `productSlug`. |
| `GET /api/admin/partners/:id` | Staff | Returns the detail, private contact fields, verification evidence, recent record links and audited activity. |
| `POST /api/admin/partners` | Admin | Accepts the legal name in `name`, plus optional `displayName`, `contactPerson`, `phone`, `email`, `website`, `address`, `internalNotes` and a `categories` array of product slugs. Returns the draft with HTTP 201. |
| `PATCH /api/admin/partners/:id` | Admin | Requires the current `version` and at least one field. Accepts the editable fields plus `isActive` and `isPublished`. Returns the updated detail and version. |
| `POST /api/admin/partners/:id/verify` | Admin | Requires the current `version` and a short evidence `reference`. Records the reviewer and returns the updated detail and version. |
| `GET /api/admin/quotes/partner-options?productSlug=automobile` | Staff | Lists up to 100 verified, active partners by ID and label. The quote and external-policy editors pass their selected category. Calling the existing selector without a category returns up to 100 verified, active partners across categories. |

Admin mutations require the session-bound CSRF token and the trusted origin. Duplicate names, stale versions and invalid transitions return 409. Invalid fields return 422. Partner detail reads and mutations write audit entries. Mutation audit entries record actions and changed field names or states, with private values kept on the protected record. The API has no hard-delete operation and does not accept logo uploads or fetch partner websites.

## Database and existing records

B10 migration `20261127050000_partner_management` extends `partners` with public display name, private contacts and notes, catalog category slugs, verification reference/reviewer/time and publication status. The existing UUID, name uniqueness and quote/contract foreign keys are preserved. The migration changes earlier active rows to inactive and advances their versions because older rows have no recorded verification. Constraints enforce verification before activation and activation before publication. The existing logo key is retained for legacy data and omitted from the interfaces.

The server checks current verification, activation and matching category when creating or issuing a quote, preparing a revision, creating a policy draft or renewal, and confirming a contract. The quote delivery worker checks eligibility again before transport, so a queued offer is withheld if the company becomes ineligible. If delivery is currently running under a valid lease, an administrator can retry the change after the job completes.

Issued quote snapshots preserve the original legal name. B10 contract confirmations freeze it in the activation snapshot. Older contracts use the original source quote's carrier name where available and can fall back to the linked partner's current name when no original name was recorded. Deactivation and partner edits preserve stored snapshots, links and private PDF files. Existing confirmed policies and quote decisions remain readable.

## Future import compatibility

A partner UUID is the stable identifier for quotes and contracts and should be retained when the source provides a trusted mapping. For an initial match where a UUID is unavailable, use the trimmed case-insensitive legal name and send uncertain matches to manual review. Display names and contact fields can change. A future authorized import can reuse `partnerFields`, `resolveCategories` and `createPartner` from the [partner model](../backend/src/modules/partners/model.ts) to apply the same validation and create inactive drafts. No import endpoints or import-specific tables were added.

## Verification and limitations

- Frontend and backend TypeScript, ESLint and production builds passed. All 6 unit tests and 44 PostgreSQL integration tests passed, including the 39 existing cases and five [partner cases](../backend/tests/partners.integration.ts).
- All seven migrations applied in an isolated fresh database. A separate B9-to-B10 upgrade fixture preserved its partner UUID, original data, accepted quote, active contract, snapshots and document relationship. PostgreSQL rejected unverified activation and inactive publication. Prisma validated the schema and reported no drift.
- Chrome completed the partner workflow at **390, 768, 1024 and 1440 px**, including public removal and byte-for-byte comparisons of quote and contract files after deactivation and rename. The browser also checked pagination, the advisor’s read-only view and external-policy category selection at all four widths. Anonymous PDF requests returned 401. The checked layouts had no page-level horizontal overflow or uncaught browser errors. Mailpit captured four quote emails with matching attachments and four internal renewal reminders.
- The supplied Stitch ZIP passed its integrity check and matched SHA-256 `57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583`.
- Partner logo uploads are deferred pending approved image validation and asset handling. No companies or partnerships are seeded. Agency settings still use demonstration data. Production quote issuance, contract uploads and reminder delivery remain subject to their existing approval and configuration requirements. The selectors and the contract list’s insurer filter display up to 100 partners. The partner management list itself is paginated.
