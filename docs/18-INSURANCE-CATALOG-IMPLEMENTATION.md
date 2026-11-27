# 18 — Live insurance catalog

The public catalog reads PostgreSQL through Express. A category appears publicly only when it is both active and published. The six seed categories start active and unpublished. The seed can run again without resetting titles or visibility that staff have already edited.

## Endpoints and who can use them

| Endpoint | Access | What it does |
| --- | --- | --- |
| `GET /api/catalog` | Public | Returns ordered public cards. Pass `?audience=INDIVIDUAL` or `?audience=BUSINESS` to request one audience. An empty catalog returns an empty array. |
| `GET /api/catalog/:slug` | Public | Returns the public detail and available related categories. Hidden, inactive and unknown categories return 404. |
| `GET /api/admin/catalog` | Staff | Lists all categories and includes publication, active state and version. |
| `GET /api/admin/catalog/:id` | Staff | Returns a category by UUID, including drafts. This endpoint was added in B4. |
| `POST /api/admin/catalog` | Admin + CSRF | Creates an unused reserved category. Returns 409 when the slot is already used. |
| `PATCH /api/admin/catalog/:id` | Admin + CSRF | Saves supplied fields using the last-read version. Returns 409 on a stale version or invalid visibility. |

Use `automobile`, `habitation`, `sante`, `voyage`, `professionnelle` and `responsabilite-civile` in URLs. Prisma uses the model enum member `responsabilite_civile`, mapped to PostgreSQL and public URL value `responsabilite-civile`. Database uniqueness protects the reserved slot even if two admins attempt to create it concurrently. A normal seed uses all six slots. Product image uploads and remote image URLs have no editor. The approved image manifest is empty.

## Follow the code

1. [PublicCatalog.tsx](../frontend/src/components/public/PublicCatalog.tsx) loads the shared catalog through [api.ts](../frontend/src/services/api.ts). [InsuranceCatalog.tsx](../frontend/src/pages/public/InsuranceCatalog/InsuranceCatalog.tsx) filters the loaded cards by audience. Home, Particuliers, header and footer use the same live list. Professionnels uses it to determine which editorial links can open a detail page.
2. [ProductDetail.tsx](../frontend/src/components/public/ProductDetail.tsx) fetches the product identified by the route. All six detail routes share this component. It shows loading, fetch failure and unavailable states, and links to `/devis?type=<slug>` for a visible product. Cards and detail pages keep the existing brand, typography and neutral imagery.
3. [InsuranceManagement.tsx](../frontend/src/pages/admin/InsuranceManagement/InsuranceManagement.tsx) loads the staff list and opens a detail dialog. [CatalogEditor.tsx](../frontend/src/pages/admin/InsuranceManagement/CatalogEditor.tsx) sends the title, summary, audiences, indicative coverages, order and visibility through the typed API. Advisors can open a read-only dialog.
4. [The catalog router](../backend/src/modules/catalog/routes.ts) projects explicit public fields and checks staff permissions. Writes validate text lengths, audiences and related slugs. The version check and catalog audit event share a transaction. Products referenced by requests keep their identity. The editor supports deactivation and the API provides no delete route.
5. [Migration 20261127010000](../backend/prisma/migrations/20261127010000_catalog_quote_intake/migration.sql) adds `insurance_products.is_active` and a constraint requiring any published category to be active. Deactivation also unpublishes the row. Reactivation leaves it a draft until an admin republishes it.

For a local test, sign in as an admin, open **Catalogue des assurances**, choose **Modifier** on a synthetic product, enter a test summary and publish it. In a fresh browser session open `/assurances` and check that the category and detail are visible. Use approved descriptions and coverages before any public publication.
