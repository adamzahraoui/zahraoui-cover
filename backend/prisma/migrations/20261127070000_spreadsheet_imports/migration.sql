BEGIN;
CREATE TYPE "import_kind" AS ENUM ('CLIENTS','PARTNERS','CONTRACTS');
CREATE TYPE "import_status" AS ENUM ('UPLOADED','VALIDATED','COMPLETED','EXPIRED');

ALTER TABLE "clients" ADD COLUMN "legacy_reference" VARCHAR(80);
ALTER TABLE "partners" ADD COLUMN "legacy_reference" VARCHAR(80);
ALTER TABLE "contracts" ADD COLUMN "legacy_reference" VARCHAR(80);
CREATE UNIQUE INDEX "clients_legacy_reference_key" ON "clients"("legacy_reference");
CREATE UNIQUE INDEX "partners_legacy_reference_key" ON "partners"("legacy_reference");
CREATE UNIQUE INDEX "contracts_legacy_reference_key" ON "contracts"("legacy_reference");

CREATE TABLE "import_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" "import_kind" NOT NULL,
  "status" "import_status" NOT NULL DEFAULT 'UPLOADED',
  "format" VARCHAR(4) NOT NULL CHECK ("format" IN ('csv','xlsx')),
  "digest" CHAR(64) NOT NULL CHECK ("digest" ~ '^[0-9a-f]{64}$'),
  "administrator_id" UUID NOT NULL REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "selection" JSONB,
  "counts" JSONB,
  "diagnostics" JSONB,
  "created_records" JSONB,
  CONSTRAINT "import_job_completion" CHECK (("status"='COMPLETED') = ("completed_at" IS NOT NULL))
);
CREATE INDEX "import_jobs_kind_digest_idx" ON "import_jobs"("kind","digest");
CREATE INDEX "import_jobs_administrator_id_created_at_id_idx" ON "import_jobs"("administrator_id","created_at","id");
CREATE INDEX "import_jobs_expires_at_idx" ON "import_jobs"("expires_at");
COMMIT;
