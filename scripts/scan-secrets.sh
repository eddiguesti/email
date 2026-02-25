#!/usr/bin/env bash
# =============================================================================
# scripts/scan-secrets.sh — plaintext secret scanner
#
# Searches tracked (and untracked) files for common secret patterns.
# Run before committing:  pnpm scan:secrets
#
# Exit codes:
#   0 — no findings
#   1 — potential secrets found (review output before pushing)
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

FINDINGS=0

# Files / dirs to always skip (templates, docs, this script itself)
EXCLUDE_PATTERNS=(
  "*.example"
  "*.template"
  "*.md"
  "*.sh"
  "node_modules"
  ".turbo"
  ".next"
  "dist"
  "build"
  "_archive"
  "pnpm-lock.yaml"
  "*.pdf"
  "*.png"
  "*.jpg"
  "*.jpeg"
  "*.webp"
  "*.svg"
  "*.ico"
)

build_exclude_args() {
  local args=()
  for p in "${EXCLUDE_PATTERNS[@]}"; do
    args+=(--exclude="$p")
  done
  # Exclude dirs
  args+=(--exclude-dir=node_modules --exclude-dir=.turbo --exclude-dir=.next \
         --exclude-dir=dist --exclude-dir=build --exclude-dir=_archive \
         --exclude-dir=.git --exclude-dir=.vercel)
  echo "${args[@]}"
}

scan() {
  local label="$1"
  local pattern="$2"
  local exclude_args
  exclude_args=$(build_exclude_args)

  # shellcheck disable=SC2086
  local hits
  hits=$(grep -rn --include="*" $exclude_args -E "$pattern" . 2>/dev/null || true)

  if [[ -n "$hits" ]]; then
    echo -e "${RED}[FAIL]${NC} $label"
    echo "$hits" | sed 's/^/       /'
    FINDINGS=$((FINDINGS + 1))
  fi
}

echo ""
echo "=== Secret scan: $REPO_ROOT ==="
echo ""

# Azure credentials
scan "Azure Client Secret (GZ98Q~ style)"       'AZURE_CLIENT_SECRET\s*[:=]\s*"?[A-Za-z0-9~._-]{30,}'
scan "Azure tenant/client UUID literals"         '(AZURE_TENANT_ID|AZURE_CLIENT_ID)\s*[:=]\s*"?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"?'

# Azure connection strings
scan "Azure Service Bus connection string"       'Endpoint=sb://[^;]+\.servicebus\.windows\.net.*SharedAccessKey=[^"&\s]{20,}'
scan "Azure Blob Storage connection string"      'AccountKey=[A-Za-z0-9+/]{40,}={0,2}'

# Supabase
scan "Supabase service role key (JWT)"           'SUPABASE_SERVICE_KEY\s*[:=]\s*"?eyJ[A-Za-z0-9_-]{20,}'

# xAI / Grok
scan "xAI API key"                               'xai-[A-Za-z0-9]{30,}'

# Webflow
scan "Webflow API token"                         'WEBFLOW_API_TOKEN\s*[:=]\s*"?[a-f0-9]{60,}'

# Kleos
scan "Kleos client secret (UUID)"                'KLEOS_CLIENT_SECRET\s*[:=]\s*"?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# Generic high-entropy hex secrets (64-char session/encryption keys)
scan "64-char hex secret"                        '(SESSION_SECRET|TOKEN_ENCRYPTION_KEY|INTERNAL_SERVICE_KEY|WEBHOOK_CLIENT_STATE)\s*[:=]\s*"?[0-9a-f]{64}'

# VAPID private key
scan "VAPID private key"                         'VAPID_PRIVATE_KEY\s*[:=]\s*"?[A-Za-z0-9_-]{40,}'

# Private key PEM blocks
scan "PEM private key block"                     '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'

echo ""
if [[ "$FINDINGS" -eq 0 ]]; then
  echo -e "${GREEN}[PASS]${NC} No plaintext secrets detected."
  echo ""
  exit 0
else
  echo -e "${YELLOW}[WARN]${NC} $FINDINGS pattern(s) matched. Review the lines above."
  echo "       False positives? Add the file to EXCLUDE_PATTERNS in scripts/scan-secrets.sh."
  echo ""
  exit 1
fi
