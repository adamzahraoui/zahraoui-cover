#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 3 || ! $1 =~ ^zahraoui-staging(-[a-z0-9]+)*$ || ! -f $2 ]]; then
  echo "Usage: $0 zahraoui-staging[-name] ENV_FILE NEW_BACKUP_DIRECTORY" >&2
  exit 2
fi

root=$(cd -- "$(dirname -- "$0")/.." && pwd)
project=$1
destination=$3
compose=(docker compose --env-file "$2" -f "$root/compose.staging.yml" -p "$project")
if [[ -e $destination || -L $destination ]]; then
  echo "Backup destination already exists." >&2
  exit 1
fi

scratch=$(mktemp -d -- "$(dirname -- "$destination")/.zc-backup.XXXXXX")
running=()
containers=()
cleanup() {
  if (( ${#containers[@]} )); then docker start "${containers[@]}" >&2; fi
  if [[ -d $scratch ]]; then
    echo "Incomplete backup is in $scratch. Treat it as private." >&2
  fi
}
trap cleanup EXIT

# Pause both writers before recording either side of the snapshot.
for service in backend worker; do
  container=$("${compose[@]}" ps --status running -q "$service")
  if [[ -n $container ]]; then
    running+=("$service")
    containers+=("$container")
  fi
done
if (( ${#running[@]} )); then "${compose[@]}" stop "${running[@]}" >&2; fi

"${compose[@]}" exec -T postgres sh -ec 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >"$scratch/database.dump"
"${compose[@]}" run --rm --no-deps -T --entrypoint tar backend -C /private-documents -cf - . >"$scratch/documents.tar"
{
  printf 'format=1\nproject=%s\ncreated_utc=%s\n' "$project" "$(date -u +%FT%TZ)"
  printf 'git_revision=%s\n' "$(git -C "$root" rev-parse HEAD)"
  if [[ -n $(git -C "$root" status --porcelain) ]]; then printf 'git_dirty=true\n'; else printf 'git_dirty=false\n'; fi
  backend=$("${compose[@]}" ps -aq backend)
  if [[ -n $backend ]]; then printf 'backend_image=%s\n' "$(docker inspect --format '{{.Image}}' "$backend")"; fi
  "${compose[@]}" exec -T postgres sh -ec 'psql -XAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version()"'
} >"$scratch/metadata.txt"

(cd -- "$scratch" && sha256sum database.dump documents.tar metadata.txt >SHA256SUMS)
mv -T -- "$scratch" "$destination"
echo "Backup created at $destination"
