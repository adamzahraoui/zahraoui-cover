BEGIN;
ALTER TABLE "assistance_cases"
  ADD COLUMN "assigned_to" UUID,
  ADD COLUMN "client_id" UUID,
  ADD COLUMN "contract_id" UUID,
  ADD CONSTRAINT "assistance_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "assistance_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "assistance_cases_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "assistance_contract_requires_client" CHECK ("contract_id" IS NULL OR "client_id" IS NOT NULL);
CREATE INDEX "assistance_cases_client_id_created_at_idx" ON "assistance_cases"("client_id", "created_at");
CREATE INDEX "assistance_cases_contract_id_idx" ON "assistance_cases"("contract_id");
CREATE INDEX "assistance_cases_assigned_to_idx" ON "assistance_cases"("assigned_to");

ALTER TABLE "request_notes"
  ALTER COLUMN "request_id" DROP NOT NULL,
  ADD COLUMN "case_id" UUID,
  ADD CONSTRAINT "request_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assistance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "request_note_has_one_parent" CHECK (num_nonnulls("request_id", "case_id") = 1);
CREATE INDEX "request_notes_case_id_created_at_id_idx" ON "request_notes"("case_id", "created_at", "id");

ALTER TABLE "contact_messages"
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD CONSTRAINT "contact_archive_requires_processed" CHECK ("archived_at" IS NULL OR "status" = 'PROCESSED');
CREATE INDEX "contact_messages_archived_at_created_at_id_idx" ON "contact_messages"("archived_at", "created_at", "id");
COMMIT;
