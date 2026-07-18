#!/bin/sh
set -eu

if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

umask 077
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}
export PATH

CONFIG_FILE=${1:-}
ACTION=${2:-deploy}

die() {
  echo "[deploy] ERROR: $*" >&2
  exit 1
}

if [ "${WIREGENE_DEPLOY_WRAPPED:-}" != "1" ]; then
  die "run deploy.sh instead so the outer DSM task timeout is enforced"
fi

if [ -z "$CONFIG_FILE" ] || [ ! -r "$CONFIG_FILE" ]; then
  die "site config is missing or unreadable: ${CONFIG_FILE:-<empty>}"
fi

case "$ACTION" in
  deploy|rollback|verify) ;;
  *) die "unsupported action '$ACTION' (use deploy, rollback, or verify)" ;;
esac

strip_config_quotes() {
  PARSED_VALUE=$1
  case "$PARSED_VALUE" in
    \"*\") PARSED_VALUE=${PARSED_VALUE#\"}; PARSED_VALUE=${PARSED_VALUE%\"} ;;
    \'*\') PARSED_VALUE=${PARSED_VALUE#\'}; PARSED_VALUE=${PARSED_VALUE%\'} ;;
  esac
}

load_site_config() {
  APP_NAME=
  APP_DIR=
  APP_IMAGE=
  APP_PORT=
  HEALTH_URL=
  APP_ENV_FILE=
  REQUIRED_ENV_VARS=
  seen_config_keys=' '

  while IFS= read -r config_line || [ -n "$config_line" ]; do
    case "$config_line" in
      ''|'#'*) continue ;;
      *=*) ;;
      *) die "malformed site.env line" ;;
    esac

    config_key=${config_line%%=*}
    config_value=${config_line#*=}
    case "$config_key" in
      APP_NAME|APP_DIR|APP_IMAGE|APP_PORT|HEALTH_URL|APP_ENV_FILE|REQUIRED_ENV_VARS) ;;
      *) die "unsupported site.env key: $config_key" ;;
    esac

    case "$seen_config_keys" in
      *" $config_key "*) die "duplicate site.env key: $config_key" ;;
    esac
    seen_config_keys="$seen_config_keys$config_key "

    strip_config_quotes "$config_value"
    config_value=$PARSED_VALUE

    case "$config_key" in
      APP_NAME)
        case "$config_value" in *[!a-z0-9_-]*|'') die "invalid APP_NAME in site.env" ;; esac
        APP_NAME=$config_value
        ;;
      APP_DIR|APP_ENV_FILE)
        case "$config_value" in /*) ;; *) die "$config_key must be an absolute path" ;; esac
        case "$config_value" in *[!a-zA-Z0-9_./-]*) die "invalid characters in $config_key" ;; esac
        if [ "$config_key" = "APP_DIR" ]; then APP_DIR=$config_value; else APP_ENV_FILE=$config_value; fi
        ;;
      APP_IMAGE)
        case "$config_value" in *[!a-zA-Z0-9_./:@-]*|'') die "invalid APP_IMAGE in site.env" ;; esac
        APP_IMAGE=$config_value
        ;;
      APP_PORT)
        case "$config_value" in *[!0-9]*|'') die "invalid APP_PORT in site.env" ;; esac
        APP_PORT=$config_value
        ;;
      HEALTH_URL)
        case "$config_value" in *[!a-zA-Z0-9_./:-]*|'') die "invalid HEALTH_URL in site.env" ;; esac
        HEALTH_URL=$config_value
        ;;
      REQUIRED_ENV_VARS)
        case "$config_value" in *[!A-Z0-9_[:space:]]*|'') die "invalid REQUIRED_ENV_VARS in site.env" ;; esac
        REQUIRED_ENV_VARS=$config_value
        ;;
    esac
  done <"$CONFIG_FILE"
}

load_site_config

require_setting() {
  setting_name=$1
  eval "setting_value=\${$setting_name:-}"
  if [ -z "$setting_value" ]; then
    die "required site setting is empty: $setting_name"
  fi
}

for setting_name in APP_NAME APP_DIR APP_IMAGE APP_PORT HEALTH_URL APP_ENV_FILE REQUIRED_ENV_VARS; do
  require_setting "$setting_name"
done

case "$APP_NAME" in
  *[!a-z0-9_-]*|'') die "APP_NAME may contain only lowercase letters, digits, '_' and '-'" ;;
esac

case "$APP_DIR" in
  /*) ;;
  *) die "APP_DIR must be an absolute NAS path" ;;
esac

case "$APP_ENV_FILE" in
  /*) ;;
  *) die "APP_ENV_FILE must be an absolute NAS path" ;;
esac

case "$APP_PORT" in
  *[!0-9]*|'') die "APP_PORT must be numeric" ;;
esac

case "$APP_IMAGE" in
  *REPLACE*|*replace*|*'<'*|*'>'*) die "APP_IMAGE must use a real published image tag" ;;
esac

if [ "$APP_PORT" -lt 1 ] || [ "$APP_PORT" -gt 65535 ]; then
  die "APP_PORT must be between 1 and 65535"
fi

case "$HEALTH_URL" in
  http://*|https://*) ;;
  *) die "HEALTH_URL must start with http:// or https://" ;;
esac

COMPOSE_FILE=$APP_DIR/docker-compose.synology.yml
STATE_DIR=$APP_DIR/.deploy
LOG_DIR=$STATE_DIR/logs
LOG_FILE=$LOG_DIR/deploy.log
LOG_COMPACT_FILE=$LOG_DIR/deploy.compact.$$
ROLLBACK_IMAGE=wiregene-local/$APP_NAME:previous
ROLLBACK_STATE_FILE=$STATE_DIR/previous-image.env
SUCCESS_STATE_FILE=$STATE_DIR/last-success.env

app_volume=${APP_DIR#/}
app_volume=${app_volume%%/*}
case "$app_volume" in
  volume[0-9]*) ;;
  *) die "APP_DIR must be under a Synology /volumeN path" ;;
esac
LOCK_ROOT=/$app_volume/docker/.wiregene-deploy-locks
LOCK_DIR=$LOCK_ROOT/$APP_NAME.lock

[ -d "$APP_DIR" ] || die "APP_DIR does not exist: $APP_DIR"
[ -r "$COMPOSE_FILE" ] || die "Compose file is missing: $COMPOSE_FILE"
[ -r "$APP_ENV_FILE" ] || die "production env file is missing: $APP_ENV_FILE"

mkdir -p "$STATE_DIR" "$LOG_DIR" "$LOCK_ROOT" || die "unable to create bounded deployment state directories"

LOCK_HELD=0
LOCK_CREATED_BY_SELF=0
LOCK_OWNER_TOKEN=
DEPLOY_CHANGED=0
DEPLOY_SUCCEEDED=0
ROLLBACK_AVAILABLE=0
AUTO_ROLLBACK_IN_PROGRESS=0
DOCKER_BIN=
CURL_BIN=
TIMEOUT_BIN=
SETSID_BIN=
ACTIVE_DEADLINE=0
ACTIVE_CHILD_PID=
ACTIVE_CHILD_GROUP=0
CAPTURED_OUTPUT=
CAPTURE_FILE=$STATE_DIR/capture.$$

process_start_fingerprint() {
  process_pid=$1
  [ -r "/proc/$process_pid/stat" ] || return 1
  awk '{print $22}' "/proc/$process_pid/stat" 2>/dev/null
}

process_matches_deploy() {
  process_pid=$1
  expected_config=$2
  [ -r "/proc/$process_pid/cmdline" ] || return 1
  process_command=$(tr '\000' ' ' <"/proc/$process_pid/cmdline" 2>/dev/null || true)
  case "$process_command" in
    *common-deploy.sh*"$expected_config"*) return 0 ;;
    *) return 1 ;;
  esac
}

lock_age_seconds() {
  lock_mtime=$(stat -c '%Y' "$LOCK_DIR" 2>/dev/null) || return 1
  lock_now=$(date +%s) || return 1
  printf '%s\n' "$((lock_now - lock_mtime))"
}

write_lock_owner() {
  SELF_START=$(process_start_fingerprint "$$") || die "unable to fingerprint deployment process"
  LOCK_OWNER_TOKEN="$$:$SELF_START:$CONFIG_FILE"
  LOCK_CREATED_BY_SELF=1
  LOCK_HELD=1
  printf '%s\n' "$LOCK_OWNER_TOKEN" >"$LOCK_DIR/owner" || die "unable to record lock owner"
  date -u '+%Y-%m-%dT%H:%M:%SZ' >"$LOCK_DIR/started-at" || die "unable to record lock timestamp"
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    write_lock_owner
  else
    if [ ! -r "$LOCK_DIR/owner" ]; then
      lock_age=$(lock_age_seconds 2>/dev/null || true)
      case "$lock_age" in
        *[!0-9]*|'') lock_age=0 ;;
      esac
      if [ "$lock_age" -lt 60 ]; then
        echo "[deploy] another deployment is acquiring the lock" >&2
        exit 75
      fi
      echo "[deploy] reclaiming an incomplete lock older than 60 seconds" >&2
    else
      lock_owner=$(sed -n '1p' "$LOCK_DIR/owner" 2>/dev/null || true)
      lock_pid=${lock_owner%%:*}
      lock_rest=${lock_owner#*:}
      lock_start=${lock_rest%%:*}
      lock_config=${lock_rest#*:}
      case "$lock_pid" in
        *[!0-9]*|'') lock_pid= ;;
      esac

      if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
        current_start=$(process_start_fingerprint "$lock_pid" 2>/dev/null || true)
        if [ -n "$current_start" ] && [ "$current_start" = "$lock_start" ] && process_matches_deploy "$lock_pid" "$lock_config"; then
          echo "[deploy] another deployment is active (pid=$lock_pid)" >&2
          exit 75
        fi
      fi
      echo "[deploy] reclaiming stale lock whose owner is no longer this deployment" >&2
    fi

    rm -f "$LOCK_DIR/owner" "$LOCK_DIR/started-at" || die "unable to remove stale lock files"
    rmdir "$LOCK_DIR" 2>/dev/null || die "stale lock directory contains unexpected files: $LOCK_DIR"
    mkdir "$LOCK_DIR" || die "unable to acquire deployment lock"
    write_lock_owner
  fi
}

release_lock() {
  if [ "$LOCK_HELD" -eq 1 ] && [ "$LOCK_CREATED_BY_SELF" -eq 1 ]; then
    current_owner=
    if [ -r "$LOCK_DIR/owner" ]; then
      current_owner=$(sed -n '1p' "$LOCK_DIR/owner" 2>/dev/null || true)
    fi

    if [ -n "$current_owner" ] && [ "$current_owner" != "$LOCK_OWNER_TOKEN" ]; then
      echo "[deploy] refusing to remove a lock owned by another process" >&2
    else
      rm -f "$LOCK_DIR/owner" "$LOCK_DIR/started-at" || true
      rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
  fi
  LOCK_HELD=0
  LOCK_CREATED_BY_SELF=0
}

rotate_log() {
  if [ -f "$LOG_FILE" ]; then
    log_size=$(wc -c <"$LOG_FILE") || die "unable to read deployment log size"
    if [ "$log_size" -ge 10485760 ]; then
      rm -f "$LOG_FILE.3" || die "unable to remove oldest deployment log"
      if [ -f "$LOG_FILE.2" ]; then
        mv "$LOG_FILE.2" "$LOG_FILE.3" || die "unable to rotate deployment log 2"
      fi
      if [ -f "$LOG_FILE.1" ]; then
        mv "$LOG_FILE.1" "$LOG_FILE.2" || die "unable to rotate deployment log 1"
      fi
      mv "$LOG_FILE" "$LOG_FILE.1" || die "unable to rotate active deployment log"
    fi
  fi
}

compact_log_at_exit() {
  [ -f "$LOG_FILE" ] || return 0
  log_size=$(wc -c <"$LOG_FILE") || return 1
  if [ "$log_size" -le 10485760 ]; then
    return 0
  fi

  tail -c 10485760 "$LOG_FILE" >"$LOG_COMPACT_FILE" || {
    rm -f "$LOG_COMPACT_FILE" 2>/dev/null || true
    return 1
  }
  mv "$LOG_COMPACT_FILE" "$LOG_FILE" || {
    rm -f "$LOG_COMPACT_FILE" 2>/dev/null || true
    return 1
  }
  return 0
}

resolve_executable() {
  executable_name=$1
  shift
  for candidate in "$@"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate=$(command -v "$executable_name" 2>/dev/null || true)
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  return 1
}

remaining_seconds() {
  now=$(date +%s) || return 1
  remaining=$((ACTIVE_DEADLINE - now))
  if [ "$remaining" -le 0 ]; then
    return 1
  fi
  printf '%s\n' "$remaining"
}

command_limit() {
  requested_limit=$1
  remaining=$(remaining_seconds) || return 1
  if [ "$requested_limit" -lt "$remaining" ]; then
    printf '%s\n' "$requested_limit"
  else
    printf '%s\n' "$remaining"
  fi
}

run_timed_soft() {
  label=$1
  requested_limit=$2
  shift 2
  limit=$(command_limit "$requested_limit") || {
    echo "[deploy] deadline exhausted before: $label" >&2
    return 124
  }

  echo "[deploy] $label (timeout=${limit}s)"
  if [ -n "$SETSID_BIN" ]; then
    "$SETSID_BIN" "$TIMEOUT_BIN" -k 15 "$limit" "$@" &
    ACTIVE_CHILD_GROUP=1
  else
    "$TIMEOUT_BIN" -k 15 "$limit" "$@" &
    ACTIVE_CHILD_GROUP=0
  fi
  ACTIVE_CHILD_PID=$!

  if wait "$ACTIVE_CHILD_PID"; then
    command_status=0
  else
    command_status=$?
  fi
  ACTIVE_CHILD_PID=
  ACTIVE_CHILD_GROUP=0
  return "$command_status"
}

run_timed() {
  label=$1
  requested_limit=$2
  shift 2
  if run_timed_soft "$label" "$requested_limit" "$@"; then
    return 0
  else
    command_status=$?
    die "$label failed (exit=$command_status)"
  fi
}

capture_timed() {
  label=$1
  requested_limit=$2
  shift 2
  limit=$(command_limit "$requested_limit") || return 124
  rm -f "$CAPTURE_FILE" || return 1
  echo "[deploy] $label (timeout=${limit}s)"

  if [ -n "$SETSID_BIN" ]; then
    "$SETSID_BIN" "$TIMEOUT_BIN" -k 10 "$limit" "$@" >"$CAPTURE_FILE" &
    ACTIVE_CHILD_GROUP=1
  else
    "$TIMEOUT_BIN" -k 10 "$limit" "$@" >"$CAPTURE_FILE" &
    ACTIVE_CHILD_GROUP=0
  fi
  ACTIVE_CHILD_PID=$!

  if wait "$ACTIVE_CHILD_PID"; then
    command_status=0
  else
    command_status=$?
  fi
  ACTIVE_CHILD_PID=
  ACTIVE_CHILD_GROUP=0

  if [ "$command_status" -ne 0 ]; then
    rm -f "$CAPTURE_FILE" || true
    return "$command_status"
  fi

  CAPTURED_OUTPUT=$(cat "$CAPTURE_FILE") || {
    rm -f "$CAPTURE_FILE" || true
    return 1
  }
  rm -f "$CAPTURE_FILE" || return 1
  return 0
}

compose_capture_container_id() {
  capture_timed "Resolve app container id" 30 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" ps -q app
  COMPOSE_CONTAINER_ID=$CAPTURED_OUTPUT
}

terminate_active_child() {
  if [ -z "$ACTIVE_CHILD_PID" ]; then
    return 0
  fi

  child_pid=$ACTIVE_CHILD_PID
  child_target=$child_pid
  if [ "$ACTIVE_CHILD_GROUP" -eq 1 ]; then
    child_target=-$child_pid
  fi

  echo "[deploy] terminating active deployment command pid=$child_pid" >&2
  kill -TERM "$child_target" 2>/dev/null || true

  child_wait=0
  while kill -0 "$child_pid" 2>/dev/null && [ "$child_wait" -lt 15 ]; do
    sleep 1 || true
    child_wait=$((child_wait + 1))
  done

  kill -KILL "$child_target" 2>/dev/null || true
  wait "$child_pid" 2>/dev/null || true
  ACTIVE_CHILD_PID=
  ACTIVE_CHILD_GROUP=0
}

verify_required_environment() {
  for env_name in $REQUIRED_ENV_VARS; do
    case "$env_name" in
      *[!A-Z0-9_]*|'') die "invalid name in REQUIRED_ENV_VARS: $env_name" ;;
    esac

    env_count=$(grep -Ec "^[[:space:]]*${env_name}[[:space:]]*=" "$APP_ENV_FILE" 2>/dev/null || true)
    if [ "$env_count" -ne 1 ]; then
      die "required production environment must be defined exactly once: $env_name"
    fi

    env_line=$(grep -E "^[[:space:]]*${env_name}[[:space:]]*=" "$APP_ENV_FILE") || die "unable to read production environment value: $env_name"
    env_value=${env_line#*=}
    env_value=$(printf '%s' "$env_value" | sed 's/[[:space:]]#.*$//;s/^[[:space:]]*#.*$//;s/^[[:space:]]*//;s/[[:space:]]*$//') || die "unable to normalize production environment value: $env_name"
    strip_config_quotes "$env_value"
    env_value=$(printf '%s' "$PARSED_VALUE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//') || die "unable to normalize quoted production environment value: $env_name"
    if [ -z "$env_value" ]; then
      die "required production environment value is empty: $env_name"
    fi

    if printf '%s\n' "$env_value" | grep -Ei '(replace-with|change-me|your-|WG-demo-2026)' >/dev/null; then
      die "placeholder or demo value is forbidden in production: $env_name"
    fi
  done
}

verify_compose_policy() {
  if grep -Eq '^[[:space:]]*build[[:space:]]*:' "$COMPOSE_FILE"; then
    die "NAS builds are forbidden: remove build: from $COMPOSE_FILE"
  fi

  run_timed "Docker daemon check" 30 "$DOCKER_BIN" info >/dev/null
  run_timed "Docker Compose v2 check" 30 "$DOCKER_BIN" compose version >/dev/null
  run_timed "Compose configuration check" 60 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" config --quiet
}

wait_for_container_health_soft() {
  wait_deadline=$(date +%s) || die "unable to read health wait clock"
  wait_deadline=$((wait_deadline + 150))

  while :; do
    now=$(date +%s) || return 1
    if [ "$now" -ge "$wait_deadline" ]; then
      echo "[deploy] container did not become healthy within 150 seconds" >&2
      return 1
    fi

    compose_capture_container_id || return 1
    container_id=$COMPOSE_CONTAINER_ID
    if [ -n "$container_id" ]; then
      capture_timed "Inspect container status" 15 "$DOCKER_BIN" inspect --format '{{.State.Status}}' "$container_id" || return 1
      container_status=$CAPTURED_OUTPUT
      capture_timed "Inspect container health" 15 "$DOCKER_BIN" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id" || return 1
      health_status=$CAPTURED_OUTPUT
      echo "[deploy] container=$container_id status=$container_status health=$health_status"
      if [ "$container_status" = "running" ] && [ "$health_status" = "healthy" ]; then
        return 0
      fi
    fi

    sleep 5 || return 1
  done
}

verify_http_health_soft() {
  capture_timed "Probe application readiness" 20 "$CURL_BIN" --fail --silent --show-error --max-time 15 "$HEALTH_URL" || return 1
  health_body=$CAPTURED_OUTPUT
  case "$health_body" in
    *'"ok":true'*) ;;
    *) echo "[deploy] readiness endpoint did not report ok=true" >&2; return 1 ;;
  esac

  compose_capture_container_id || return 1
  verified_container_id=$COMPOSE_CONTAINER_ID
  [ -n "$verified_container_id" ] || return 1

  capture_timed "Verify deployed image reference" 15 "$DOCKER_BIN" inspect --format '{{.Config.Image}}' "$verified_container_id" || return 1
  configured_image=$CAPTURED_OUTPUT
  if [ "$configured_image" != "$APP_IMAGE" ]; then
    echo "[deploy] running image reference does not match APP_IMAGE: $configured_image" >&2
    return 1
  fi

  capture_timed "Read deployed image version" 15 "$DOCKER_BIN" inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$verified_container_id" || return 1
  image_version=$CAPTURED_OUTPUT
  if [ -n "$image_version" ] && [ "$image_version" != "<no value>" ]; then
    case "$health_body" in
      *'"version":"'"$image_version"'"'*) ;;
      *) echo "[deploy] readiness version does not match image label: $image_version" >&2; return 1 ;;
    esac
  fi

  echo "[deploy] health endpoint verified: $HEALTH_URL"
  return 0
}

verify_no_deploy_processes() {
  active_jobs=$(jobs -p 2>/dev/null || true)
  if [ -n "$active_jobs" ]; then
    echo "[deploy] background shell jobs remain: $active_jobs" >&2
    return 1
  fi

  for process_dir in /proc/[0-9]*; do
    [ -r "$process_dir/cmdline" ] || continue
    process_pid=${process_dir#/proc/}
    if [ "$process_pid" = "$$" ] || [ "$process_pid" = "${PPID:-}" ]; then
      continue
    fi
    process_command=$(tr '\000' ' ' <"$process_dir/cmdline" 2>/dev/null || true)
    case "$process_command" in
      *"$COMPOSE_FILE"*)
        echo "[deploy] Compose-related process remains after deployment: pid=$process_pid" >&2
        return 1
        ;;
    esac
  done
  return 0
}

verify_runtime_soft() {
  wait_for_container_health_soft || return 1
  verify_http_health_soft || return 1
  verify_no_deploy_processes || return 1
  return 0
}

verify_runtime() {
  if ! verify_runtime_soft; then
    die "runtime verification failed"
  fi
}

attempt_automatic_rollback() {
  if [ "$DEPLOY_CHANGED" -ne 1 ] || [ "$ROLLBACK_AVAILABLE" -ne 1 ]; then
    return 0
  fi

  AUTO_ROLLBACK_IN_PROGRESS=1
  ACTIVE_DEADLINE=$OVERALL_DEADLINE
  echo "[deploy] attempting automatic rollback to $ROLLBACK_IMAGE" >&2
  APP_IMAGE=$ROLLBACK_IMAGE
  export APP_IMAGE

  if run_timed_soft "Automatic rollback" 120 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" up -d --remove-orphans --no-build; then
    if verify_runtime_soft; then
      echo "[deploy] automatic rollback completed" >&2
    else
      echo "[deploy] rollback container started but full runtime verification failed; run the documented rollback/verify commands" >&2
    fi
  else
    echo "[deploy] automatic rollback failed; run the documented rollback command" >&2
  fi
}

cleanup() {
  cleanup_status=$?
  trap - 0
  trap '' 1 2 15

  terminate_active_child

  if [ "$cleanup_status" -ne 0 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$AUTO_ROLLBACK_IN_PROGRESS" -ne 1 ]; then
    attempt_automatic_rollback || true
  fi

  rm -f "$CAPTURE_FILE" 2>/dev/null || true
  release_lock
  finished_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || printf 'unknown')
  echo "[deploy] finished action=$ACTION exit=$cleanup_status at=$finished_at"
  if ! compact_log_at_exit; then
    echo "[deploy] ERROR: unable to enforce the 10 MiB deployment log cap" >&2
    cleanup_status=1
  fi
  exit "$cleanup_status"
}

started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || die "unable to read start timestamp"
START_EPOCH=$(date +%s) || die "unable to read start clock"
NORMAL_DEADLINE=$((START_EPOCH + 720))
OVERALL_DEADLINE=$((START_EPOCH + 900))
ACTIVE_DEADLINE=$NORMAL_DEADLINE

trap cleanup 0
trap 'exit 129' 1
trap 'exit 130' 2
trap 'exit 143' 15

acquire_lock
rotate_log
exec >>"$LOG_FILE" 2>&1

echo "[deploy] start action=$ACTION app=$APP_NAME at=$started_at pid=$$"

DOCKER_BIN=$(resolve_executable docker /usr/local/bin/docker /usr/bin/docker /bin/docker /var/packages/ContainerManager/target/usr/bin/docker /var/packages/Docker/target/usr/bin/docker) || die "Docker executable not found in DSM-safe paths"
CURL_BIN=$(resolve_executable curl /usr/bin/curl /bin/curl /usr/local/bin/curl) || die "curl executable not found in DSM-safe paths"
TIMEOUT_BIN=$(resolve_executable timeout /usr/bin/timeout /bin/timeout /usr/local/bin/timeout) || die "timeout executable not found in DSM-safe paths"
SETSID_BIN=$(resolve_executable setsid /usr/bin/setsid /bin/setsid /usr/local/bin/setsid) || die "setsid executable is required for process-group cleanup"

if ! "$TIMEOUT_BIN" -k 1 1 /bin/true >/dev/null 2>&1; then
  die "timeout executable does not support required kill-after syntax"
fi

export APP_NAME APP_DIR APP_IMAGE APP_PORT APP_ENV_FILE

verify_required_environment
verify_compose_policy

case "$ACTION" in
  verify)
    verify_runtime
    ;;

  rollback)
    run_timed "Rollback image check" 30 "$DOCKER_BIN" image inspect "$ROLLBACK_IMAGE" >/dev/null
    APP_IMAGE=$ROLLBACK_IMAGE
    export APP_IMAGE
    run_timed "Rollback container start" 120 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" up -d --remove-orphans --no-build
    verify_runtime
    ;;

  deploy)
    compose_capture_container_id || die "unable to inspect the existing app container"
    previous_container_id=$COMPOSE_CONTAINER_ID
    if [ -n "$previous_container_id" ]; then
      capture_timed "Inspect existing image" 30 "$DOCKER_BIN" inspect --format '{{.Image}}' "$previous_container_id" || die "unable to inspect the existing image"
      previous_image_id=$CAPTURED_OUTPUT
      run_timed "Preserve previous image" 60 "$DOCKER_BIN" image tag "$previous_image_id" "$ROLLBACK_IMAGE"
      ROLLBACK_AVAILABLE=1
      {
        printf 'APP_IMAGE=%s\n' "$ROLLBACK_IMAGE"
        printf 'PREVIOUS_IMAGE_ID=%s\n' "$previous_image_id"
        printf 'PRESERVED_AT=%s\n' "$started_at"
      } >"$ROLLBACK_STATE_FILE" || die "unable to record rollback state"
    else
      echo "[deploy] no existing app container; first deployment has no automatic rollback image"
    fi

    run_timed "Pull CI-built image" 480 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" pull --quiet app
    DEPLOY_CHANGED=1
    run_timed "Start detached application" 120 "$DOCKER_BIN" compose --env-file "$CONFIG_FILE" -p "$APP_NAME" -f "$COMPOSE_FILE" up -d --remove-orphans --no-build
    verify_runtime

    compose_capture_container_id || die "unable to inspect deployed container"
    deployed_container_id=$COMPOSE_CONTAINER_ID
    capture_timed "Inspect deployed image" 30 "$DOCKER_BIN" inspect --format '{{.Image}}' "$deployed_container_id" || die "unable to inspect deployed image"
    deployed_image_id=$CAPTURED_OUTPUT
    completed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || die "unable to read completion timestamp"
    {
      printf 'APP_IMAGE=%s\n' "$APP_IMAGE"
      printf 'IMAGE_ID=%s\n' "$deployed_image_id"
      printf 'CONTAINER_ID=%s\n' "$deployed_container_id"
      printf 'DEPLOYED_AT=%s\n' "$completed_at"
    } >"$SUCCESS_STATE_FILE" || die "unable to record successful deployment state"
    ;;
esac

DEPLOY_SUCCEEDED=1
echo "[deploy] action=$ACTION completed successfully"
exit 0
