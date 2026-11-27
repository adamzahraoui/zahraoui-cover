-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('ADVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "client_profile" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "audience" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "product_slug" AS ENUM ('automobile', 'habitation', 'sante', 'voyage', 'professionnelle', 'responsabilite-civile');

-- CreateEnum
CREATE TYPE "contact_method" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "quote_situation" AS ENUM ('NEW_POLICY', 'RENEWAL', 'SWITCH_PROVIDER');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "assistance_status" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "assistance_priority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('UNREAD', 'READ', 'PROCESSED');

-- CreateEnum
CREATE TYPE "intake_action" AS ENUM ('QUOTE_REQUEST', 'ASSISTANCE', 'CONTACT');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "document_kind" AS ENUM ('QUOTE_PDF', 'CONTRACT_PDF');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('QUEUED', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "job_kind" AS ENUM ('REQUEST_ALERT', 'REQUEST_ACK', 'ASSISTANCE_ALERT', 'CONTACT_ALERT', 'CONTACT_ACK', 'RESET_EMAIL', 'GENERATE_PDF', 'RENEWAL_ALERT');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "email" VARCHAR(254) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "role" "staff_role" NOT NULL,
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "slug" "product_slug" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "audiences" "audience"[],
    "image_key" TEXT,
    "potential_coverages" JSONB NOT NULL,
    "eligibility_text" TEXT NOT NULL,
    "document_hints" JSONB NOT NULL,
    "faqs" JSONB NOT NULL,
    "related_slugs" "product_slug"[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "display_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "insurance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "profile" "client_profile" NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254),
    "city" VARCHAR(100),
    "notes" VARCHAR(1000),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notice_version" VARCHAR(32) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "product_id" UUID NOT NULL,
    "client_id" UUID,
    "assigned_to" UUID,
    "profile" "client_profile" NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "preferred_contact" "contact_method" NOT NULL DEFAULT 'PHONE',
    "desired_start_on" DATE,
    "situation" "quote_situation" NOT NULL DEFAULT 'NEW_POLICY',
    "needs" VARCHAR(1000) NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'NEW',
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" UUID NOT NULL,
    "author_id" UUID,
    "body" VARCHAR(1000) NOT NULL,

    CONSTRAINT "request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistance_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notice_version" VARCHAR(32) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "product_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "contract_reference" VARCHAR(64),
    "description" VARCHAR(1000) NOT NULL,
    "status" "assistance_status" NOT NULL DEFAULT 'NEW',
    "priority" "assistance_priority" NOT NULL DEFAULT 'NORMAL',
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "assistance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notice_version" VARCHAR(32) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'UNREAD',
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_keys" (
    "action" "intake_action" NOT NULL,
    "key" UUID NOT NULL,
    "body_fingerprint" BYTEA NOT NULL,
    "request_id" UUID,
    "case_id" UUID,
    "message_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "submission_keys_pkey" PRIMARY KEY ("action","key")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "scope" VARCHAR(32) NOT NULL,
    "key_hash" BYTEA NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "hits" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("scope","key_hash","window_start")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" UUID,
    "request_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(120) NOT NULL,
    "website" VARCHAR(300),
    "logo_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reference" VARCHAR(32) NOT NULL,
    "client_id" UUID NOT NULL,
    "request_id" UUID,
    "product_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "created_by" UUID,
    "annual_premium_mad" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "conditions" VARCHAR(2000),
    "status" "quote_status" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "issued_snapshot" JSONB,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reference" VARCHAR(32) NOT NULL,
    "client_id" UUID NOT NULL,
    "quote_id" UUID,
    "product_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "created_by" UUID,
    "policy_number" VARCHAR(64) NOT NULL,
    "effective_on" DATE NOT NULL,
    "expires_on" DATE NOT NULL,
    "status" "contract_status" NOT NULL DEFAULT 'DRAFT',
    "activated_at" TIMESTAMPTZ(6),
    "activation_snapshot" JSONB,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quote_id" UUID,
    "contract_id" UUID,
    "kind" "document_kind" NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'QUEUED',
    "storage_key" TEXT,
    "sha256" BYTEA,
    "size_bytes" BIGINT,
    "ready_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "agency_name" VARCHAR(120) NOT NULL,
    "office_phone" VARCHAR(16) NOT NULL,
    "assistance_phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254),
    "address" VARCHAR(300),
    "hours" VARCHAR(300),

    CONSTRAINT "agency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "job_kind" NOT NULL,
    "dedupe_key" VARCHAR(128) NOT NULL,
    "request_id" UUID,
    "case_id" UUID,
    "message_id" UUID,
    "reset_id" UUID,
    "document_id" UUID,
    "contract_id" UUID,
    "encrypted_secret" BYTEA,
    "state" "job_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL,
    "lease_until" TIMESTAMPTZ(6),
    "lease_token" UUID,
    "finished_at" TIMESTAMPTZ(6),
    "last_error_code" VARCHAR(64),

    CONSTRAINT "outbox_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_is_active_display_name_id_idx" ON "staff_users"("is_active", "display_name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_staff_id_revoked_at_idx" ON "admin_sessions"("staff_id", "revoked_at");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_staff_id_expires_at_idx" ON "password_reset_tokens"("staff_id", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_products_slug_key" ON "insurance_products"("slug");

-- CreateIndex
CREATE INDEX "insurance_products_is_published_display_order_id_idx" ON "insurance_products"("is_published", "display_order", "id");

-- CreateIndex
CREATE INDEX "clients_archived_at_created_at_id_idx" ON "clients"("archived_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_email_idx" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_reference_key" ON "quote_requests"("reference");

-- CreateIndex
CREATE INDEX "quote_requests_created_at_id_idx" ON "quote_requests"("created_at", "id");

-- CreateIndex
CREATE INDEX "quote_requests_status_created_at_id_idx" ON "quote_requests"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "quote_requests_product_id_created_at_idx" ON "quote_requests"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "quote_requests_client_id_created_at_idx" ON "quote_requests"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "quote_requests_assigned_to_created_at_idx" ON "quote_requests"("assigned_to", "created_at");

-- CreateIndex
CREATE INDEX "quote_requests_phone_idx" ON "quote_requests"("phone");

-- CreateIndex
CREATE INDEX "quote_requests_closed_at_idx" ON "quote_requests"("closed_at");

-- CreateIndex
CREATE INDEX "request_notes_request_id_created_at_id_idx" ON "request_notes"("request_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "request_notes_author_id_idx" ON "request_notes"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistance_cases_reference_key" ON "assistance_cases"("reference");

-- CreateIndex
CREATE INDEX "assistance_cases_status_created_at_id_idx" ON "assistance_cases"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "assistance_cases_priority_created_at_id_idx" ON "assistance_cases"("priority", "created_at", "id");

-- CreateIndex
CREATE INDEX "assistance_cases_product_id_idx" ON "assistance_cases"("product_id");

-- CreateIndex
CREATE INDEX "assistance_cases_closed_at_idx" ON "assistance_cases"("closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "contact_messages_reference_key" ON "contact_messages"("reference");

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_id_idx" ON "contact_messages"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "contact_messages_processed_at_idx" ON "contact_messages"("processed_at");

-- CreateIndex
CREATE INDEX "submission_keys_expires_at_idx" ON "submission_keys"("expires_at");

-- CreateIndex
CREATE INDEX "submission_keys_request_id_idx" ON "submission_keys"("request_id");

-- CreateIndex
CREATE INDEX "submission_keys_case_id_idx" ON "submission_keys"("case_id");

-- CreateIndex
CREATE INDEX "submission_keys_message_id_idx" ON "submission_keys"("message_id");

-- CreateIndex
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_created_at_idx" ON "audit_events"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_target_type_target_id_created_at_idx" ON "audit_events"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "partners_is_active_name_id_idx" ON "partners"("is_active", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_reference_key" ON "quotes"("reference");

-- CreateIndex
CREATE INDEX "quotes_status_created_at_id_idx" ON "quotes"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "quotes_client_id_created_at_idx" ON "quotes"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "quotes_request_id_idx" ON "quotes"("request_id");

-- CreateIndex
CREATE INDEX "quotes_product_id_idx" ON "quotes"("product_id");

-- CreateIndex
CREATE INDEX "quotes_partner_id_idx" ON "quotes"("partner_id");

-- CreateIndex
CREATE INDEX "quotes_created_by_idx" ON "quotes"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_reference_key" ON "contracts"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_quote_id_key" ON "contracts"("quote_id");

-- CreateIndex
CREATE INDEX "contracts_status_expires_on_id_idx" ON "contracts"("status", "expires_on", "id");

-- CreateIndex
CREATE INDEX "contracts_client_id_expires_on_idx" ON "contracts"("client_id", "expires_on");

-- CreateIndex
CREATE INDEX "contracts_product_id_idx" ON "contracts"("product_id");

-- CreateIndex
CREATE INDEX "contracts_created_by_idx" ON "contracts"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_partner_id_policy_number_key" ON "contracts"("partner_id", "policy_number");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_status_created_at_idx" ON "documents"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_jobs_dedupe_key_key" ON "outbox_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_jobs_state_next_attempt_at_id_idx" ON "outbox_jobs"("state", "next_attempt_at", "id");

-- CreateIndex
CREATE INDEX "outbox_jobs_state_lease_until_idx" ON "outbox_jobs"("state", "lease_until");

-- CreateIndex
CREATE INDEX "outbox_jobs_finished_at_idx" ON "outbox_jobs"("finished_at");

-- CreateIndex
CREATE INDEX "outbox_jobs_request_id_idx" ON "outbox_jobs"("request_id");

-- CreateIndex
CREATE INDEX "outbox_jobs_case_id_idx" ON "outbox_jobs"("case_id");

-- CreateIndex
CREATE INDEX "outbox_jobs_message_id_idx" ON "outbox_jobs"("message_id");

-- CreateIndex
CREATE INDEX "outbox_jobs_reset_id_idx" ON "outbox_jobs"("reset_id");

-- CreateIndex
CREATE INDEX "outbox_jobs_document_id_idx" ON "outbox_jobs"("document_id");

-- CreateIndex
CREATE INDEX "outbox_jobs_contract_id_idx" ON "outbox_jobs"("contract_id");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_keys" ADD CONSTRAINT "submission_keys_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_keys" ADD CONSTRAINT "submission_keys_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assistance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_keys" ADD CONSTRAINT "submission_keys_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assistance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_reset_id_fkey" FOREIGN KEY ("reset_id") REFERENCES "password_reset_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- PostgreSQL constraints and indexes that Prisma's schema language cannot express.
ALTER TABLE staff_users
  ADD CONSTRAINT staff_email_canonical CHECK (email = lower(btrim(email)) AND email <> ''),
  ADD CONSTRAINT staff_name_present CHECK (btrim(display_name) <> '');
ALTER TABLE admin_sessions
  ADD CONSTRAINT session_token_hash_size CHECK (octet_length(token_hash) = 32),
  ADD CONSTRAINT session_dates CHECK (expires_at > created_at AND last_seen_at <= expires_at);
ALTER TABLE password_reset_tokens
  ADD CONSTRAINT reset_token_hash_size CHECK (octet_length(token_hash) = 32),
  ADD CONSTRAINT reset_token_dates CHECK (expires_at > created_at AND NOT (used_at IS NOT NULL AND invalidated_at IS NOT NULL));

ALTER TABLE insurance_products
  ALTER COLUMN audiences SET NOT NULL,
  ALTER COLUMN related_slugs SET NOT NULL,
  ADD CONSTRAINT product_audience_values CHECK (
    cardinality(audiences) BETWEEN 1 AND 2
    AND array_position(audiences, NULL) IS NULL
    AND (cardinality(audiences) = 1 OR audiences[1] <> audiences[2])
  ),
  ADD CONSTRAINT product_related_values CHECK (array_position(related_slugs, NULL) IS NULL AND NOT slug = ANY(related_slugs)),
  ADD CONSTRAINT product_display_order CHECK (display_order BETWEEN 0 AND 999),
  ADD CONSTRAINT product_json_arrays CHECK (
    jsonb_typeof(potential_coverages) = 'array' AND jsonb_typeof(document_hints) = 'array' AND jsonb_typeof(faqs) = 'array'
  );
ALTER TABLE quote_requests ADD CONSTRAINT quote_request_closed_status
  CHECK ((closed_at IS NOT NULL) = (status IN ('ACCEPTED', 'DECLINED', 'CLOSED')));
ALTER TABLE assistance_cases ADD CONSTRAINT assistance_closed_status
  CHECK ((closed_at IS NOT NULL) = (status = 'RESOLVED'));
ALTER TABLE contact_messages ADD CONSTRAINT contact_processed_status
  CHECK ((processed_at IS NOT NULL) = (status = 'PROCESSED'));
ALTER TABLE submission_keys
  ADD CONSTRAINT submission_body_fingerprint_size CHECK (octet_length(body_fingerprint) = 32),
  ADD CONSTRAINT submission_key_target CHECK (
    num_nonnulls(request_id, case_id, message_id) = 1 AND CASE action
      WHEN 'QUOTE_REQUEST' THEN request_id IS NOT NULL
      WHEN 'ASSISTANCE' THEN case_id IS NOT NULL
      WHEN 'CONTACT' THEN message_id IS NOT NULL
    END
  );
ALTER TABLE rate_limits
  ADD CONSTRAINT rate_limit_values CHECK (hits > 0 AND expires_at > window_start AND octet_length(key_hash) = 32);
ALTER TABLE audit_events ADD CONSTRAINT audit_event_target_and_metadata
  CHECK ((target_type IS NULL) = (target_id IS NULL) AND jsonb_typeof(metadata) = 'object');

ALTER TABLE partners ADD CONSTRAINT partner_https_website CHECK (website IS NULL OR website LIKE 'https://%');
ALTER TABLE quotes ADD CONSTRAINT quote_currency_and_premium
  CHECK (currency = 'MAD' AND annual_premium_mad > 0 AND annual_premium_mad <> 'NaN'::numeric);
ALTER TABLE contracts ADD CONSTRAINT contract_dates CHECK (expires_on > effective_on);
ALTER TABLE documents
  ADD CONSTRAINT document_parent CHECK (num_nonnulls(quote_id, contract_id) = 1 AND (kind = 'QUOTE_PDF') = (quote_id IS NOT NULL)),
  ADD CONSTRAINT document_revision CHECK (revision > 0),
  ADD CONSTRAINT document_ready_metadata CHECK (status <> 'READY' OR (
    storage_key IS NOT NULL AND storage_key ~ '^[0-9a-f-]{36}[.]pdf$' AND sha256 IS NOT NULL
    AND octet_length(sha256) = 32 AND size_bytes IS NOT NULL AND size_bytes > 0 AND ready_at IS NOT NULL
  ));
ALTER TABLE agency_settings ADD CONSTRAINT agency_settings_singleton CHECK (id = 1);
ALTER TABLE outbox_jobs
  ADD CONSTRAINT outbox_job_target CHECK (
    num_nonnulls(request_id, case_id, message_id, reset_id, document_id, contract_id) = 1 AND CASE kind
      WHEN 'REQUEST_ALERT' THEN request_id IS NOT NULL
      WHEN 'REQUEST_ACK' THEN request_id IS NOT NULL
      WHEN 'ASSISTANCE_ALERT' THEN case_id IS NOT NULL
      WHEN 'CONTACT_ALERT' THEN message_id IS NOT NULL
      WHEN 'CONTACT_ACK' THEN message_id IS NOT NULL
      WHEN 'RESET_EMAIL' THEN reset_id IS NOT NULL
      WHEN 'GENERATE_PDF' THEN document_id IS NOT NULL
      WHEN 'RENEWAL_ALERT' THEN contract_id IS NOT NULL
    END
  ),
  ADD CONSTRAINT outbox_job_state CHECK (
    attempt_count >= 0
    AND (state = 'RUNNING') = (lease_until IS NOT NULL AND lease_token IS NOT NULL)
    AND (lease_until IS NULL) = (lease_token IS NULL)
    AND (state IN ('SUCCEEDED', 'FAILED')) = (finished_at IS NOT NULL)
    AND (kind = 'RESET_EMAIL' AND state IN ('PENDING', 'RUNNING')) = (encrypted_secret IS NOT NULL)
  );

ALTER TABLE staff_users ADD CONSTRAINT staff_version_positive CHECK (version > 0);
ALTER TABLE clients ADD CONSTRAINT client_version_positive CHECK (version > 0);
ALTER TABLE insurance_products ADD CONSTRAINT insurance_version_positive CHECK (version > 0);
ALTER TABLE quote_requests ADD CONSTRAINT request_version_positive CHECK (version > 0);
ALTER TABLE assistance_cases ADD CONSTRAINT assistance_version_positive CHECK (version > 0);
ALTER TABLE contact_messages ADD CONSTRAINT contact_version_positive CHECK (version > 0);
ALTER TABLE partners ADD CONSTRAINT partner_version_positive CHECK (version > 0);
ALTER TABLE quotes ADD CONSTRAINT quote_version_positive CHECK (version > 0);
ALTER TABLE contracts ADD CONSTRAINT contract_version_positive CHECK (version > 0);
ALTER TABLE agency_settings ADD CONSTRAINT agency_version_positive CHECK (version > 0);

CREATE INDEX clients_display_name_prefix_idx ON clients (lower(display_name) text_pattern_ops);
CREATE INDEX clients_city_prefix_idx ON clients (lower(city) text_pattern_ops);
CREATE INDEX quote_requests_last_name_prefix_idx ON quote_requests (lower(last_name) text_pattern_ops);
CREATE INDEX quote_requests_first_name_prefix_idx ON quote_requests (lower(first_name) text_pattern_ops);
CREATE UNIQUE INDEX partners_lower_name_key ON partners (lower(name));
CREATE UNIQUE INDEX documents_quote_revision_key ON documents (quote_id, revision) WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX documents_contract_revision_key ON documents (contract_id, revision) WHERE contract_id IS NOT NULL;

-- Enforce revocation even for operator-side account changes.
CREATE FUNCTION revoke_staff_credentials() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE admin_sessions SET revoked_at = now() WHERE staff_id = NEW.id AND revoked_at IS NULL;
  UPDATE password_reset_tokens SET invalidated_at = now()
    WHERE staff_id = NEW.id AND used_at IS NULL AND invalidated_at IS NULL;
  UPDATE outbox_jobs AS job SET
    state = 'FAILED', encrypted_secret = NULL, lease_token = NULL, lease_until = NULL,
    last_error_code = 'RESET_INVALIDATED', finished_at = now()
    FROM password_reset_tokens AS reset
    WHERE job.reset_id = reset.id AND reset.staff_id = NEW.id
      AND job.state IN ('PENDING', 'RUNNING');
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_credential_change
AFTER UPDATE OF password_hash, role, is_active ON staff_users
FOR EACH ROW WHEN (
  OLD.password_hash IS DISTINCT FROM NEW.password_hash
  OR OLD.role IS DISTINCT FROM NEW.role
  OR OLD.is_active IS DISTINCT FROM NEW.is_active
)
EXECUTE FUNCTION revoke_staff_credentials();
