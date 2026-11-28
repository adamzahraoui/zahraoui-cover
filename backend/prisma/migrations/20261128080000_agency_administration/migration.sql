BEGIN;
ALTER TABLE agency_settings
  ADD COLUMN public_approved_at TIMESTAMPTZ(6),
  ADD COLUMN legal_name VARCHAR(180),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN whatsapp_phone VARCHAR(16),
  ADD COLUMN website VARCHAR(300),
  ADD COLUMN social_links JSONB,
  ADD COLUMN registration VARCHAR(300),
  ADD COLUMN authorization_reference VARCHAR(300),
  ADD COLUMN brand_asset VARCHAR(100),
  ADD COLUMN notification_preferences JSONB,
  ADD COLUMN reminder_days INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

INSERT INTO agency_settings (id,updated_at,agency_name,office_phone,assistance_phone)
VALUES (1,CURRENT_TIMESTAMP,'Zahraoui Cover','+212523281585','+212522542323') ON CONFLICT (id) DO NOTHING;

CREATE TYPE agency_content_kind AS ENUM ('LEGAL','PRIVACY','COOKIES','QUOTE','EMAIL');

CREATE TABLE agency_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind agency_content_kind NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 8000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMPTZ(6),
  publisher_id UUID REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT agency_content_publication CHECK ((published_at IS NULL) = (publisher_id IS NULL))
);
CREATE INDEX agency_contents_kind_published_at_id_idx ON agency_contents(kind,published_at,id);
CREATE INDEX agency_contents_publisher_id_idx ON agency_contents(publisher_id);

CREATE FUNCTION retain_published_agency_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published agency content is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER agency_content_immutable BEFORE UPDATE OR DELETE ON agency_contents
  FOR EACH ROW EXECUTE FUNCTION retain_published_agency_content();

ALTER TABLE quote_requests ADD COLUMN notice_text TEXT;
ALTER TABLE contact_messages ADD COLUMN notice_text TEXT;
ALTER TABLE assistance_cases ADD COLUMN notice_text TEXT;
COMMIT;
