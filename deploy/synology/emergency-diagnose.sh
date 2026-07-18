#!/bin/sh
set -eu

PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH

SCRIPT_DIR=$(CDPATH= cd -P "$(dirname "$0")" && pwd) || {
  echo "[emergency-diagnose] unable to resolve script directory" >&2
  exit 1
}
REPO_ROOT=$(CDPATH= cd -P "$SCRIPT_DIR/../.." && pwd) || {
  echo "[emergency-diagnose] unable to resolve repository root" >&2
  exit 1
}

find_timeout() {
  for candidate in /usr/bin/timeout /bin/timeout /usr/local/bin/timeout; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if [ "${WIREGENE_EMERGENCY_DIAG_WRAPPED:-0}" != "1" ]; then
  EMERGENCY_TIMEOUT_BIN=$(find_timeout) || {
    echo "[emergency-diagnose] kill-capable timeout is required" >&2
    exit 1
  }
  if ! "$EMERGENCY_TIMEOUT_BIN" -k 1 1 /bin/true >/dev/null 2>&1; then
    echo "[emergency-diagnose] timeout must support '-k KILL_AFTER DURATION'" >&2
    exit 1
  fi
  WIREGENE_EMERGENCY_DIAG_WRAPPED=1
  export WIREGENE_EMERGENCY_DIAG_WRAPPED EMERGENCY_TIMEOUT_BIN
  exec "$EMERGENCY_TIMEOUT_BIN" -k 5 60 /bin/sh "$0" "$@"
fi

TIMEOUT_BIN=${EMERGENCY_TIMEOUT_BIN:-}
if [ ! -x "$TIMEOUT_BIN" ]; then
  TIMEOUT_BIN=$(find_timeout) || {
    echo "[emergency-diagnose] timeout executable disappeared" >&2
    exit 1
  }
fi

section() {
  printf '\n=== %s ===\n' "$1"
}

run_soft() {
  soft_limit=$1
  shift
  "$TIMEOUT_BIN" -k 2 "$soft_limit" "$@"
}

find_docker() {
  for candidate in \
    /usr/local/bin/docker \
    /usr/bin/docker \
    /var/packages/ContainerManager/target/usr/bin/docker \
    /var/packages/Docker/target/usr/bin/docker; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

collect_diagnostics() {
  section "safety notice"
  echo "READ-ONLY stdout collection: no file, task, process, container, service, lock, or database is changed."
  echo "Treat all output as sensitive. Share only requested lines after redacting secrets."
  if [ "$(id -u 2>/dev/null || echo unknown)" != "0" ]; then
    echo "WARNING: run through 'sudo -i' for complete host diagnostics."
  fi

  section "clock and DSM version"
  run_soft 5 date -u '+UTC %Y-%m-%dT%H:%M:%SZ' 2>&1 || echo "date failed or timed out"
  if [ -r /etc.defaults/VERSION ]; then
    sed -n -e '/^majorversion=/p' -e '/^minorversion=/p' -e '/^productversion=/p' \
      -e '/^buildnumber=/p' -e '/^smallfixnumber=/p' /etc.defaults/VERSION
  fi
  run_soft 5 uname -a 2>&1 || echo "uname failed or timed out"
  run_soft 5 uptime 2>&1 || echo "uptime failed or timed out"

  section "filesystem capacity and inodes"
  run_soft 10 df -h 2>&1 || echo "df -h failed or timed out"
  run_soft 10 df -i 2>&1 || echo "df -i failed or timed out"

  section "suspect scheduler and foreground processes"
  SELF_PID=$$
  found_process=0
  RUNNING_TASK_IDS=
  for procdir in /proc/[0-9]*; do
    pid=${procdir##*/}
    [ "$pid" = "$SELF_PID" ] && continue
    [ -r "$procdir/cmdline" ] || continue
    process_command=$(tr '\000' ' ' <"$procdir/cmdline" 2>/dev/null || true)
    process_type=
    case "$process_command" in
      *synoschedtask*--run*) process_type=synoschedtask-wrapper ;;
      *"docker logs -f"*) process_type=docker-log-follower ;;
      *"tail -f"*) process_type=tail-follower ;;
      *"docker compose up"*|*"docker-compose up"*) process_type=attached-compose-up ;;
      *"docker compose build"*|*"docker-compose build"*) process_type=nas-compose-build ;;
      *deploy.sh*|*common-deploy.sh*) process_type=wiregene-deploy ;;
      *"node server.mjs"*) process_type=direct-node-server ;;
      *"npm start"*|*"npm run start"*) process_type=direct-npm-server ;;
      *"npm run dev"*|*"next dev"*) process_type=development-server ;;
      *"npm run build"*) process_type=nas-npm-build ;;
      *"next start"*) process_type=direct-next-server ;;
    esac
    [ -n "$process_type" ] || continue

    found_process=1
    printf 'PID=%s TYPE=%s\n' "$pid" "$process_type"
    sed -n -e '/^Name:/p' -e '/^State:/p' -e '/^Pid:/p' -e '/^PPid:/p' "$procdir/status" 2>/dev/null || true
    case "$process_command" in
      *synoschedtask*--run*id=*)
        task_id_tail=${process_command#*--run id=}
        task_id=${task_id_tail%%[!0-9]*}
        case "$task_id" in
          ''|*[!0-9]*) ;;
          *)
            printf 'TASK_ID=%s\n' "$task_id"
            case " $RUNNING_TASK_IDS " in
              *" $task_id "*) ;;
              *) RUNNING_TASK_IDS="$RUNNING_TASK_IDS $task_id" ;;
            esac
            ;;
        esac
        ;;
    esac
    echo
  done
  [ "$found_process" -eq 1 ] || echo "No matching suspect process found."

  section "Docker containers (read only)"
  if DOCKER_BIN=$(find_docker); then
    run_soft 12 "$DOCKER_BIN" ps --no-trunc \
      --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' 2>&1 || \
      echo "docker ps failed or timed out"
  else
    echo "Docker executable not found in supported Synology paths."
  fi

  section "scheduler incident log match counts"
  for scheduler_log in /var/log/synocrond-execute.log /var/log/synoscheduler.log; do
    if [ -r "$scheduler_log" ]; then
      echo "--- $scheduler_log ---"
      log_sample=$(run_soft 8 tail -n 500 "$scheduler_log" 2>/dev/null || true)
      printf '%s\n' "$log_sample" | awk '
        BEGIN { skipped=0; locked=0; malformed=0; conflict=0 }
        {
          line=tolower($0)
          if (index(line, "already running") || index(line, "skipped because")) skipped++
          if (index(line, "database is locked")) locked++
          if (index(line, "database disk image is malformed")) malformed++
          if (index(line, "conflict with task") || index(line, "sched_task_run") || index(line, "sched_task_db")) conflict++
        }
        END {
          printf "already-running-or-skipped=%d database-locked=%d database-malformed=%d scheduler-conflict=%d\n", skipped, locked, malformed, conflict
        }
      '
    fi
  done

  section "Wiregene deployment locks (read only)"
  found_lock=0
  for owner_file in /volume[0-9]*/docker/.wiregene-deploy-locks/*.lock/owner; do
    [ -f "$owner_file" ] || continue
    found_lock=1
    printf '%s: ' "$owner_file"
    sed -n '1p' "$owner_file" 2>/dev/null || true
  done
  [ "$found_lock" -eq 1 ] || echo "No Wiregene deployment lock owner file found."

  section "running DSM task definitions"
  echo "WARNING: Command fields may contain secrets; redact them before sharing."
  if [ -z "$RUNNING_TASK_IDS" ]; then
    echo "No running synoschedtask wrapper ID was discovered."
  elif [ -x /usr/syno/bin/synoschedtask ]; then
    task_query_count=0
    for running_task_id in $RUNNING_TASK_IDS; do
      task_query_count=$((task_query_count + 1))
      if [ "$task_query_count" -gt 3 ]; then
        echo "Additional running task definitions omitted after the first three IDs."
        break
      fi
      echo "--- Task ID $running_task_id ---"
      if task_output=$(run_soft 8 /usr/syno/bin/synoschedtask --get id="$running_task_id" 2>&1); then
        printf '%s\n' "$task_output" | LC_ALL=C tr -cd '\11\12\15\40-\176' | \
          awk '
            /^[[:space:]]*(User|ID|Name|State|Owner|App|AppName|Type|Start date|Run time|Last Run Time|Next Trigger|Status):/ { print }
          '
        echo "Command and continuation: [REDACTED - inspect locally]"
      else
        echo "synoschedtask query for id=$running_task_id failed or timed out"
      fi
    done
  else
    echo "/usr/syno/bin/synoschedtask not found"
  fi

}

case "${1:-}" in
  '')
    collect_diagnostics
    ;;
  *)
    echo "Usage: /bin/sh $0" >&2
    exit 64
    ;;
esac
