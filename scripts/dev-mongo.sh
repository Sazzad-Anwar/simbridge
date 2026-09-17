#!/usr/bin/env bash
# SIMBridge — start a LOCAL MongoDB without Docker.
# Downloads the official MongoDB community binary once, then runs it
# against a local data directory. Safe to re-run (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="8.0.4"
TOOLS_DIR="$ROOT/.tools"
MONGO_HOME="$TOOLS_DIR/mongodb"
DATA_DIR="$TOOLS_DIR/mongo-data"
LOG_FILE="$TOOLS_DIR/mongod.log"
PORT="${MONGO_PORT:-27017}"
URI="mongodb://127.0.0.1:${PORT}/simbridge"

mkdir -p "$TOOLS_DIR" "$DATA_DIR"

if [ ! -x "$MONGO_HOME/bin/mongod" ]; then
  echo "==> Downloading MongoDB $VERSION (one-time, ~100MB)..."
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)  TARBALL="mongodb-linux-x86_64-debian12-$VERSION" ;;
    Linux-aarch64) TARBALL="mongodb-linux-aarch64-ubuntu2204-$VERSION" ;;
    Darwin-arm64)  TARBALL="mongodb-macos-arm64-$VERSION" ;;
    Darwin-x86_64) TARBALL="mongodb-macos-x86_64-$VERSION" ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m). Use docker compose up -d instead."; exit 1 ;;
  esac
  curl -fL "https://fastdl.mongodb.org/${TARBALL}.tgz" -o "$TOOLS_DIR/mongodb.tgz"
  tar -xzf "$TOOLS_DIR/mongodb.tgz" -C "$TOOLS_DIR"
  EXTRACTED="$(tar -tzf "$TOOLS_DIR/mongodb.tgz" | head -1 | cut -d/ -f1)"
  rm -rf "$MONGO_HOME"
  mv "$TOOLS_DIR/$EXTRACTED" "$MONGO_HOME"
  rm -f "$TOOLS_DIR/mongodb.tgz"
fi

if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
  echo "==> MongoDB already running on port $PORT"
else
  echo "==> Starting mongod (port $PORT, data: $DATA_DIR)..."
  "$MONGO_HOME/bin/mongod" \
    --dbpath "$DATA_DIR" \
    --port "$PORT" \
    --bind_ip 127.0.0.1 \
    --logpath "$LOG_FILE" \
    --fork
  echo "==> MongoDB is ready."
fi

echo "==> Connection string: $URI"
