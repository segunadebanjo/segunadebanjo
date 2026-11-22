#!/usr/bin/env bash
# InsurePress Studio: one-command install / update for an Ubuntu or Debian VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/segunadebanjo/segunadebanjo/ccr-c74a1e40-x4h3hv/insurepress-studio/deploy/install.sh | bash
#
# First run: installs Docker, downloads the code, asks for your domain (and optional email / AI
# settings), generates every password and secret, opens the firewall and starts the site.
# Later runs: pull the latest code and rebuild. Your .env and data are kept.
#
# Non-interactive use: set DOMAIN (and optionally SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
# MAIL_FROM, ANTHROPIC_API_KEY, ALLOW_REGISTRATION) in the environment and add ASSUME_YES=1.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/segunadebanjo/segunadebanjo.git}"
BRANCH="${BRANCH:-ccr-c74a1e40-x4h3hv}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/insurepress}"
APP_DIR="$INSTALL_DIR/insurepress-studio"
SKIP_START="${SKIP_START:-0}"          # 1 = prepare everything but don't start containers (testing)
SKIP_DOCKER_INSTALL="${SKIP_DOCKER_INSTALL:-0}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[36m›\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Read answers from the terminal even when this script is piped from curl.
TTY=/dev/tty
ask() { # ask VAR "Question" "default"
  local __var=$1 __q=$2 __def=${3:-} __ans=""
  if [ -n "${!__var:-}" ]; then return; fi
  if [ "${ASSUME_YES:-0}" = 1 ] || [ ! -r "$TTY" ]; then printf -v "$__var" '%s' "$__def"; return; fi
  if [ -n "$__def" ]; then read -r -p "  $__q [$__def]: " __ans < "$TTY" || true; else read -r -p "  $__q: " __ans < "$TTY" || true; fi
  printf -v "$__var" '%s' "${__ans:-$__def}"
}
ask_secret() {
  local __var=$1 __q=$2 __ans=""
  if [ -n "${!__var:-}" ] || [ "${ASSUME_YES:-0}" = 1 ] || [ ! -r "$TTY" ]; then return; fi
  read -r -s -p "  $__q: " __ans < "$TTY" || true; echo
  printf -v "$__var" '%s' "$__ans"
}
rand() { openssl rand -hex "${1:-24}"; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || die "Run as root or install sudo."
  SUDO="sudo"
fi

bold "InsurePress Studio installer"

# ---- 1. System checks -------------------------------------------------------------------------
if [ -r /etc/os-release ]; then . /etc/os-release; info "System: ${PRETTY_NAME:-unknown}"; fi
case "${ID:-}${ID_LIKE:-}" in *debian*|*ubuntu*) ;; *) warn "Tested on Ubuntu/Debian. Other systems may need manual steps." ;; esac
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if [ "$mem_mb" -gt 0 ] && [ "$mem_mb" -lt 1900 ]; then
  warn "Only ${mem_mb} MB RAM. PDF export needs about 2 GB; consider adding swap (see DEPLOY.md)."
fi
for tool in git openssl curl; do
  command -v "$tool" >/dev/null || { info "Installing $tool"; $SUDO apt-get update -qq && $SUDO apt-get install -y -qq "$tool" >/dev/null; }
done

# ---- 2. Docker --------------------------------------------------------------------------------
if ! command -v docker >/dev/null && [ "$SKIP_START" != 1 ]; then
  [ "$SKIP_DOCKER_INSTALL" = 1 ] && die "Docker is not installed."
  info "Installing Docker (get.docker.com)"
  curl -fsSL https://get.docker.com | $SUDO sh >/dev/null
fi
DOCKER="docker"
if [ "$SKIP_START" != 1 ]; then
  docker info >/dev/null 2>&1 || DOCKER="$SUDO docker"   # not yet in the docker group: use sudo
  $DOCKER compose version >/dev/null 2>&1 || die "Docker Compose plugin missing. Install docker-compose-plugin and re-run."
  info "Docker ready"
fi

# ---- 3. Code ----------------------------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating code in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch -q origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout -q "$BRANCH"
  git -C "$INSTALL_DIR" merge -q --ff-only "origin/$BRANCH" || die "Local changes in $INSTALL_DIR block the update. Commit or discard them, then re-run."
else
  info "Downloading code to $INSTALL_DIR"
  git clone -q --depth 1 -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
[ -f "$APP_DIR/docker-compose.yml" ] || die "Unexpected repository layout: $APP_DIR/docker-compose.yml not found."
cd "$APP_DIR"

# ---- 4. Configuration (.env) ------------------------------------------------------------------
if [ -f .env ]; then
  info "Keeping existing .env (delete it to reconfigure)"
  DOMAIN=$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2-)
else
  bold "Configuration"
  ask DOMAIN "Domain for the site (its DNS A record must point here), e.g. studio.yourbrokerage.ng"
  [ -n "${DOMAIN:-}" ] || die "A domain is required."
  DOMAIN=${DOMAIN#http://}; DOMAIN=${DOMAIN#https://}; DOMAIN=${DOMAIN%%/*}
  ask ALLOW_REGISTRATION "Let anyone sign up from the login page? (true/false)" "false"
  echo "  Email lets users reset forgotten passwords. Leave the SMTP host empty to skip (you can add it later in .env)."
  ask SMTP_HOST "SMTP host (e.g. smtp.gmail.com, smtp.zoho.com, smtp-relay.brevo.com)" ""
  if [ -n "${SMTP_HOST:-}" ]; then
    ask SMTP_PORT "SMTP port" "587"
    ask SMTP_USER "SMTP username" ""
    ask_secret SMTP_PASS "SMTP password / app password (hidden)"
    ask MAIL_FROM "Send emails from" "InsurePress Studio <${SMTP_USER:-no-reply@$DOMAIN}>"
  fi
  ask_secret ANTHROPIC_API_KEY "Anthropic API key for live AI (hidden; Enter to skip = mock mode)"

  case "${SMTP_PORT:-587}" in 465) SMTP_SECURE=true ;; *) SMTP_SECURE=false ;; esac
  umask 077
  # Values are single-quoted so passwords containing $, # or spaces survive Docker Compose parsing.
  for v in "${SMTP_USER:-}" "${SMTP_PASS:-}" "${MAIL_FROM:-}" "${ANTHROPIC_API_KEY:-}"; do
    case "$v" in *"'"*) die "Values can't contain a single quote ('). Use a different password, or edit .env by hand afterwards." ;; esac
  done
  q() { printf "'%s'" "$1"; }
  {
    echo "# Generated by deploy/install.sh on $(date -u +%Y-%m-%dT%H:%MZ). Keep this file private."
    echo "DOMAIN=$DOMAIN"
    echo "PUBLIC_URL=https://$DOMAIN"
    echo "JWT_SECRET=$(rand 32)"
    echo "ALLOW_REGISTRATION=${ALLOW_REGISTRATION:-false}"
    echo "MYSQL_ROOT_PASSWORD=$(rand 24)"
    echo "DB_NAME=insurepress_studio"
    echo "DB_USER=insurepress"
    echo "DB_PASSWORD=$(rand 24)"
    echo "SMTP_HOST=${SMTP_HOST:-}"
    echo "SMTP_PORT=${SMTP_PORT:-587}"
    echo "SMTP_SECURE=$SMTP_SECURE"
    echo "SMTP_USER=$(q "${SMTP_USER:-}")"
    echo "SMTP_PASS=$(q "${SMTP_PASS:-}")"
    echo "MAIL_FROM=$(q "${MAIL_FROM:-}")"
    echo "RESET_LINK_MINUTES=60"
    echo "ANTHROPIC_API_KEY=$(q "${ANTHROPIC_API_KEY:-}")"
    echo "ANTHROPIC_MODEL=claude-opus-5-5"
    echo "ANTHROPIC_EFFORT=medium"
  } > .env
  chmod 600 .env
  info "Wrote .env with generated database passwords and session secret"
fi

# ---- 5. DNS check -----------------------------------------------------------------------------
if [ -n "${DOMAIN:-}" ] && [ "${DOMAIN#:}" = "$DOMAIN" ]; then
  public_ip=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)
  domain_ip=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)
  if [ -z "$domain_ip" ]; then
    warn "$DOMAIN doesn't resolve yet. Add an A record pointing to ${public_ip:-this server}, then re-run; HTTPS will fail until it resolves."
  elif [ -n "$public_ip" ] && [ "$domain_ip" != "$public_ip" ]; then
    warn "$DOMAIN points to $domain_ip, but this server is $public_ip. HTTPS will fail until DNS is updated."
  else
    info "DNS: $DOMAIN → $domain_ip"
  fi
fi

# ---- 6. Firewall ------------------------------------------------------------------------------
if command -v ufw >/dev/null && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null && info "Firewall: opened ports 80 and 443"
fi

if [ "$SKIP_START" = 1 ]; then
  bold "Prepared (SKIP_START=1): not starting containers."
  exit 0
fi

# ---- 7. Start ---------------------------------------------------------------------------------
bold "Building and starting (the first build takes about 5 minutes)"
$DOCKER compose up -d --build
info "Waiting for the app to become healthy"
for _ in $(seq 1 60); do
  state=$($DOCKER inspect -f '{{.State.Health.Status}}' "$($DOCKER compose ps -q app)" 2>/dev/null || echo starting)
  [ "$state" = healthy ] && break
  sleep 5
done
[ "${state:-}" = healthy ] || { $DOCKER compose logs --tail 40 app; die "The app didn't become healthy. See the log above."; }
$DOCKER compose logs app 2>/dev/null | grep -E "Email:|Email is not" | tail -1 | sed 's/^.*| /  › /' || true

bold "Done!"
echo "  Open https://$DOMAIN and create the admin account NOW: until you do, anyone who visits can."
echo "  Optional sample book:   cd $APP_DIR && $DOCKER compose exec app node server/db/seed.js"
echo "  Update later:           re-run this installer"
echo "  Logs:                   cd $APP_DIR && $DOCKER compose logs -f app"
