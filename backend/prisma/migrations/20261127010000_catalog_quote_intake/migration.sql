BEGIN;

ALTER TABLE insurance_products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE insurance_products ADD CONSTRAINT product_published_requires_active
  CHECK (NOT is_published OR is_active);

ALTER TABLE clients ADD COLUMN intake_provisional BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
