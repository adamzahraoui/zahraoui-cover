BEGIN;
ALTER TABLE "partners"
  ALTER COLUMN "is_active" SET DEFAULT FALSE,
  ADD COLUMN "display_name" VARCHAR(120),
  ADD COLUMN "contact_person" VARCHAR(120),
  ADD COLUMN "phone" VARCHAR(16),
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "address" VARCHAR(300),
  ADD COLUMN "internal_notes" VARCHAR(2000),
  ADD COLUMN "categories" "product_slug"[] NOT NULL DEFAULT ARRAY[]::"product_slug"[],
  ADD COLUMN "verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "verified_by" UUID,
  ADD COLUMN "verification_reference" VARCHAR(160),
  ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT "partners_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Earlier records have no recorded verification. Preserve identifiers and foreign keys.
UPDATE "partners" SET "is_active"=FALSE, "version"="version"+1, "updated_at"=CURRENT_TIMESTAMP WHERE "is_active";

ALTER TABLE "partners"
  ADD CONSTRAINT "partner_verification_metadata" CHECK (
    ("verified_at" IS NULL AND "verification_reference" IS NULL AND "verified_by" IS NULL) OR
    ("verified_at" IS NOT NULL AND "verification_reference" IS NOT NULL AND cardinality("categories") > 0)
  ),
  ADD CONSTRAINT "partner_activation_requires_verification" CHECK (NOT "is_active" OR "verified_at" IS NOT NULL),
  ADD CONSTRAINT "partner_publication_requires_activation" CHECK (NOT "is_published" OR "is_active");
CREATE INDEX "partners_is_published_name_id_idx" ON "partners" ("is_published", "name", "id");
CREATE INDEX "partners_verified_by_idx" ON "partners" ("verified_by");
COMMIT;
