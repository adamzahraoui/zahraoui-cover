#!/bin/sh
set -eu

# The URL in Compose requires a hexadecimal password without URL escaping.
case "$APP_DB_PASSWORD" in
  *[!0123456789abcdefABCDEF]*|'') echo 'APP_DB_PASSWORD must be hexadecimal' >&2; exit 1 ;;
esac
[ "${#APP_DB_PASSWORD}" -eq 64 ] || { echo 'APP_DB_PASSWORD must have 64 hex characters' >&2; exit 1; }

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password APP_DB_PASSWORD
CREATE ROLE zc_stage_app LOGIN PASSWORD :'app_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO zc_stage_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zc_stage_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO zc_stage_app;
SQL
