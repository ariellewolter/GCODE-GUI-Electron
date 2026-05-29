#!/usr/bin/env bash
# Push macOS release secrets to GitHub Actions (GCODE-GUI-Electron by default).
set -euo pipefail

REPO="${1:-ariellewolter/GCODE-GUI-Electron}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${SECRETS_ENV:-$ROOT/.github/secrets.env}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo ""
  echo "Setup:"
  echo "  1. cp .github/secrets.env.example .github/secrets.env"
  echo "  2. open -e .github/secrets.env   # fill in all 5 values"
  echo "  3. Read .github/SECRETS_SETUP.md if you are unsure what to enter"
  echo "  4. Run this script again"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

missing=()
[[ -z "${APPLE_ID:-}" ]] && missing+=("APPLE_ID")
[[ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]] && missing+=("APPLE_APP_SPECIFIC_PASSWORD")
[[ -z "${APPLE_TEAM_ID:-}" ]] && missing+=("APPLE_TEAM_ID")
[[ -z "${MACOS_CERT_PASSWORD:-}" ]] && missing+=("MACOS_CERT_PASSWORD")
[[ -z "${MACOS_CERT_P12_PATH:-}" ]] && missing+=("MACOS_CERT_P12_PATH")

if ((${#missing[@]} > 0)); then
  echo "Error: Set these in $ENV_FILE: ${missing[*]}"
  exit 1
fi

if [[ ! -f "$MACOS_CERT_P12_PATH" ]]; then
  echo "Error: MACOS_CERT_P12_PATH not found: $MACOS_CERT_P12_PATH"
  exit 1
fi

echo "Setting secrets on $REPO ..."

gh secret set APPLE_ID --repo "$REPO" --body "$APPLE_ID"
gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO" --body "$APPLE_APP_SPECIFIC_PASSWORD"
gh secret set APPLE_TEAM_ID --repo "$REPO" --body "$APPLE_TEAM_ID"
gh secret set MACOS_CERT_PASSWORD --repo "$REPO" --body "$MACOS_CERT_PASSWORD"
base64 < "$MACOS_CERT_P12_PATH" | gh secret set MACOS_CERT_P12 --repo "$REPO"

echo ""
echo "Done. Installed secrets:"
gh secret list --repo "$REPO"
