BEGIN;
ALTER TABLE "quotes"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "previous_id" UUID,
  ADD COLUMN "coverage" VARCHAR(3000),
  ADD COLUMN "coverage_limits" VARCHAR(2000),
  ADD COLUMN "deductibles" VARCHAR(2000),
  ADD COLUMN "customer_notes" VARCHAR(2000),
  ADD COLUMN "internal_notes" VARCHAR(2000),
  ADD COLUMN "fees_mad" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxes_mad" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "total_mad" DECIMAL(12,2),
  ADD COLUMN "valid_until" DATE,
  ADD COLUMN "sent_at" TIMESTAMPTZ(6),
  ADD COLUMN "decided_by" UUID,
  ADD COLUMN "decision_method" VARCHAR(16),
  ADD COLUMN "decision_evidence" VARCHAR(1000),
  ADD CONSTRAINT "quotes_previous_id_fkey" FOREIGN KEY ("previous_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "quotes_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "quote_amounts" CHECK (fees_mad >= 0 AND taxes_mad >= 0 AND (total_mad IS NULL OR total_mad = annual_premium_mad + fees_mad + taxes_mad)),
  ADD CONSTRAINT "quote_revision_positive" CHECK (revision > 0 AND (previous_id IS NULL) = (revision = 1)),
  ADD CONSTRAINT "quote_sent_requires_transport_timestamp" CHECK (status <> 'SENT' OR sent_at IS NOT NULL);
CREATE UNIQUE INDEX "quotes_previous_id_key" ON "quotes"("previous_id");
CREATE INDEX "quotes_decided_by_idx" ON "quotes"("decided_by");
CREATE INDEX "quotes_valid_until_idx" ON "quotes"("valid_until");

ALTER TABLE "documents" ADD COLUMN "quote_version" INTEGER,
  ADD COLUMN "mime_type" VARCHAR(32),
  ADD CONSTRAINT "quote_document_metadata" CHECK (quote_version IS NULL OR (quote_id IS NOT NULL AND quote_version > 0 AND mime_type IS NOT DISTINCT FROM 'application/pdf'));

ALTER TABLE "outbox_jobs" DROP CONSTRAINT "outbox_job_target",
  ADD CONSTRAINT "outbox_job_target" CHECK (
    num_nonnulls(request_id, case_id, message_id, reset_id, document_id, contract_id) = 1 AND CASE kind
      WHEN 'REQUEST_ALERT' THEN request_id IS NOT NULL
      WHEN 'REQUEST_ACK' THEN request_id IS NOT NULL
      WHEN 'ASSISTANCE_ALERT' THEN case_id IS NOT NULL
      WHEN 'CONTACT_ALERT' THEN message_id IS NOT NULL
      WHEN 'CONTACT_ACK' THEN message_id IS NOT NULL
      WHEN 'RESET_EMAIL' THEN reset_id IS NOT NULL
      WHEN 'GENERATE_PDF' THEN document_id IS NOT NULL
      WHEN 'QUOTE_DELIVERY' THEN document_id IS NOT NULL
      WHEN 'RENEWAL_ALERT' THEN contract_id IS NOT NULL
    END
  );
COMMIT;
