#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 3 || ! $1 =~ ^zahraoui-staging-restore(-[a-z0-9]+)+$ || ! -f $2 || ! -d $3 ]]; then
  echo "Usage: $0 zahraoui-staging-restore-NAME ENV_FILE BACKUP_DIRECTORY" >&2
  exit 2
fi

root=$(cd -- "$(dirname -- "$0")/.." && pwd)
project=$1
backup=$3
compose=(docker compose --env-file "$2" -f "$root/compose.staging.yml" -p "$project")

if [[ -n $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ||
      -n $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]]; then
  echo "Restore requires a new project with no existing containers or volumes." >&2
  exit 1
fi

(cd -- "$backup" && sha256sum database.dump documents.tar metadata.txt | cmp - SHA256SUMS)
grep -qxF 'format=1' "$backup/metadata.txt"

# Validate the private archive before extracting it. Files are flat, UUID-named and never links.
python3 - "$backup/documents.tar" <<'PY'
import re
import sys
import tarfile

with tarfile.open(sys.argv[1], mode="r:") as archive:
    seen = set()
    for entry in archive:
        name = entry.name.removeprefix("./")
        if entry.isdir() and name == ".":
            continue
        if (not entry.isfile() or name in seen or
            not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|tmp)", name) or
            entry.size > 4 * 1024 * 1024 or entry.mode & 0o077):
            sys.exit("Unexpected private archive entry")
        seen.add(name)
PY

# Keep the reverse proxy, backend server, worker and SMTP sink stopped during the restore.
"${compose[@]}" up -d --wait --wait-timeout 60 postgres
"${compose[@]}" exec -T postgres sh -ec 'pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <"$backup/database.dump"
"${compose[@]}" run --rm --no-deps -T --entrypoint tar backend --no-same-owner --no-same-permissions -C /private-documents -xf - <"$backup/documents.tar"
"${compose[@]}" run --rm --no-deps -T migrate node node_modules/prisma/build/index.js migrate status
"${compose[@]}" run --rm --no-deps -T migrate node node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
"${compose[@]}" run --rm --no-deps -T backend node check-documents.mjs
echo "Restored and verified $project. Only its PostgreSQL service is running."
