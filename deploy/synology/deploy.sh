#!/bin/sh
set -eu

PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}
export PATH

SCRIPT_DIR=$(CDPATH= cd -P "$(dirname "$0")" && pwd) || {
  echo "[deploy] unable to resolve script directory" >&2
  exit 1
}

CONFIG_FILE=${WIREGENE_SITE_CONFIG:-$SCRIPT_DIR/site.env}
ACTION=${1:-deploy}
COMMON_SCRIPT=$SCRIPT_DIR/common-deploy.sh

if [ ! -r "$CONFIG_FILE" ]; then
  echo "[deploy] missing readable site config: $CONFIG_FILE" >&2
  exit 1
fi

if [ ! -r "$COMMON_SCRIPT" ]; then
  echo "[deploy] missing common deployment engine: $COMMON_SCRIPT" >&2
  exit 1
fi

find_timeout() {
  for candidate in /usr/bin/timeout /bin/timeout /usr/local/bin/timeout; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate=$(command -v timeout 2>/dev/null || true)
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  return 1
}

TIMEOUT_BIN=$(find_timeout) || {
  echo "[deploy] timeout executable is required; refusing an unbounded DSM task" >&2
  exit 1
}

if ! "$TIMEOUT_BIN" -k 1 1 /bin/true >/dev/null 2>&1; then
  echo "[deploy] timeout must support '-k KILL_AFTER DURATION'" >&2
  exit 1
fi

# The common engine normally caps itself at 15 minutes. This outer guard also
# terminates unexpected filesystem or shell hangs and prevents a stuck DSM task.
WIREGENE_DEPLOY_WRAPPED=1
export WIREGENE_DEPLOY_WRAPPED
exec "$TIMEOUT_BIN" -k 30 1200 /bin/sh "$COMMON_SCRIPT" "$CONFIG_FILE" "$ACTION"
