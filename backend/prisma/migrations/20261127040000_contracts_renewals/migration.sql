BEGIN;
ALTER TABLE "contracts" ALTER COLUMN "policy_number" DROP NOT NULL,
  ADD COLUMN "previous_id" UUID,
  ADD COLUMN "source_quote_snapshot" JSONB,
  ADD COLUMN "coverage" VARCHAR(3000),
  ADD COLUMN "premium_mad" DECIMAL(12,2),
  ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
  ADD COLUMN "internal_notes" VARCHAR(2000),
  ADD COLUMN "confirmation_reference" VARCHAR(160),
  ADD COLUMN "confirmation_on" DATE,
  ADD COLUMN "confirmed_by" UUID,
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_reason" VARCHAR(1000),
  ADD COLUMN "renewal_reminders" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT "contracts_previous_id_fkey" FOREIGN KEY ("previous_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contracts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contract_premium" CHECK (currency = 'MAD' AND (premium_mad IS NULL OR (premium_mad > 0 AND premium_mad <> 'NaN'::numeric))),
  ADD CONSTRAINT "contract_confirmation" CHECK ((confirmation_reference IS NULL) = (confirmation_on IS NULL)
    AND (confirmation_on IS NULL OR (policy_number IS NOT NULL AND activated_at IS NOT NULL))),
  ADD CONSTRAINT "contract_cancellation" CHECK ((cancelled_at IS NULL) = (cancellation_reason IS NULL)
    AND (cancelled_at IS NULL OR status = 'CANCELLED')),
  ADD CONSTRAINT "contract_previous_distinct" CHECK (previous_id IS DISTINCT FROM id);
CREATE UNIQUE INDEX "contracts_open_renewal" ON "contracts" ("previous_id") WHERE "previous_id" IS NOT NULL AND ("status" <> 'CANCELLED' OR "activated_at" IS NOT NULL);
CREATE INDEX "contracts_previous_id_idx" ON "contracts"("previous_id");
CREATE INDEX "contracts_confirmed_by_idx" ON "contracts"("confirmed_by");
CREATE INDEX "contracts_partner_id_idx" ON "contracts"("partner_id");

ALTER TABLE "outbox_jobs" ADD COLUMN "reminder_expires_on" DATE, ADD COLUMN "reminder_days" SMALLINT,
  ADD CONSTRAINT "renewal_job_metadata" CHECK (
    (reminder_expires_on IS NULL AND reminder_days IS NULL) OR
    (kind = 'RENEWAL_ALERT' AND reminder_expires_on IS NOT NULL AND reminder_days IS NOT NULL AND reminder_days BETWEEN 1 AND 365)
  );
COMMIT;
