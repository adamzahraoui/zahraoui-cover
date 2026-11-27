ALTER TYPE "document_kind" ADD VALUE 'CONTRACT_SUPPORT';
ALTER TYPE "document_kind" ADD VALUE 'BUSINESS_PDF';

ALTER TABLE "documents"
  ADD COLUMN "original_name" VARCHAR(180),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "uploaded_by" UUID,
  ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "document_archive_eligible" CHECK (archived_at IS NULL OR (kind NOT IN ('QUOTE_PDF', 'CONTRACT_PDF') AND status = 'READY')),
  ADD CONSTRAINT "document_version_positive" CHECK (version > 0);

CREATE INDEX "documents_kind_created_at_id_idx" ON "documents" ("kind", "created_at", "id");
CREATE INDEX "documents_archived_at_created_at_id_idx" ON "documents" ("archived_at", "created_at", "id");
CREATE INDEX "documents_contract_id_kind_revision_idx" ON "documents" ("contract_id", "kind", "revision");
CREATE INDEX "documents_quote_id_idx" ON "documents" ("quote_id");
CREATE INDEX "documents_uploaded_by_idx" ON "documents" ("uploaded_by");
