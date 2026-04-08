#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
OUTPUT_FILE="${1:-$ROOT_DIR/supabase/baseline/full_database_schema.sql}"

mkdir -p "$(dirname "$OUTPUT_FILE")"

{
  printf '%s\n' '-- Full database baseline for fresh client setup.'
  printf '%s\n' '-- Generated from the ordered Supabase migration files in this repo.'
  printf '%s\n' '-- Run this file by itself against an empty database.'
  printf '%s\n' '-- Do not run this baseline together with the split migration files for the same fresh database.'
  printf '\n'

  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort | while read -r migration; do
    relative_path="${migration#$ROOT_DIR/}"
    printf '%s\n' "-- Source: $relative_path"
    printf '\n'
    cat "$migration"
    printf '\n\n'
  done
} > "$OUTPUT_FILE"

printf 'Baseline written to %s\n' "$OUTPUT_FILE"
