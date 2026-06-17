#!/usr/bin/env bash
# Build restore SQL from Supabase cluster dump.
# - Multiple sed runs so auth.users comes before auth.identities (macOS sed prints ranges
#   in source-file line order when given in one invocation).
# - Only public.* constraints/indexes/FKs: a wide 5859-6893 slice includes realtime/storage/auth
#   and duplicates keys already present on a fresh Supabase project.
set -euo pipefail
BACKUP="${1:?Usage: $0 /path/to/db_cluster-....backup}"
OUT="${2:-$HOME/fst_restore_public_auth.sql}"
{
  sed -n '3286,3503p' "$BACKUP"
  sed -n '4013,4015p' "$BACKUP"
  sed -n '3786,3788p' "$BACKUP"
  sed -n '4019,5391p' "$BACKUP"
  sed -n '5859,5927p' "$BACKUP"
  sed -n '6387,6467p' "$BACKUP"
  sed -n '6753,6893p' "$BACKUP"
  sed -n '7041,7140p' "$BACKUP"
} >"$OUT"
echo "Wrote $OUT"
