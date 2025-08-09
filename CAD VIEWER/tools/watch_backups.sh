#!/usr/bin/env bash
set -euo pipefail

# Simple polling-based watcher to back up key files on change.
# macOS compatible, no external deps.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

FILE0="$ROOT_DIR/unified-viewer.html"
FILE1="$ROOT_DIR/UNIFIED_VIEWER_ANALYSIS.md"

hash_file() {
  local f="$1"
  if [ -f "$f" ]; then
    shasum -a 256 "$f" | awk '{print $1}'
  else
    echo "missing"
  fi
}

LAST_HASH_0="$(hash_file "$FILE0")"
LAST_HASH_1="$(hash_file "$FILE1")"

echo "[watch_backups] Watching files for changes..."

while true; do
  # Check FILE0
  CUR0="$(hash_file "$FILE0")"
  if [ "$LAST_HASH_0" != "$CUR0" ]; then
    ts="$(date +%Y%m%d-%H%M%S)"
    dest="$BACKUP_DIR/$ts"
    mkdir -p "$dest"
    if [ -f "$FILE0" ]; then
      cp -f "$FILE0" "$dest/"
      echo "[watch_backups] Change detected -> backed up $(basename "$FILE0") to backups/$ts/"
    else
      echo "[watch_backups] File missing: $FILE0"
    fi
    LAST_HASH_0="$CUR0"
  fi

  # Check FILE1
  CUR1="$(hash_file "$FILE1")"
  if [ "$LAST_HASH_1" != "$CUR1" ]; then
    ts="$(date +%Y%m%d-%H%M%S)"
    dest="$BACKUP_DIR/$ts"
    mkdir -p "$dest"
    if [ -f "$FILE1" ]; then
      cp -f "$FILE1" "$dest/"
      echo "[watch_backups] Change detected -> backed up $(basename "$FILE1") to backups/$ts/"
    else
      echo "[watch_backups] File missing: $FILE1"
    fi
    LAST_HASH_1="$CUR1"
  fi

  sleep 2
done


