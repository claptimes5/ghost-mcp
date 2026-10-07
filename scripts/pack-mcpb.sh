#!/usr/bin/env bash
# Builds dist/ghost-mcp.mcpb, a Claude Desktop extension. Desktop stores the sensitive
# settings (the API key) in the OS keychain instead of a plain-text config file.
set -euo pipefail

# Pinned, and run with npx rather than installed: the CLI's own dependencies have open
# advisories (in signing and interactive prompts, neither used here) that would otherwise
# show up in this project's npm audit.
MCPB="@anthropic-ai/mcpb@2.1.2"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

package_version="$(node -p 'require("./package.json").version')"
manifest_version="$(node -p 'require("./manifest.json").version')"
if [[ "$package_version" != "$manifest_version" ]]; then
    echo "manifest.json version ($manifest_version) doesn't match package.json ($package_version)" >&2
    exit 1
fi

npm run build

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp -r build package.json package-lock.json manifest.json LICENSE "$stage/"
(cd "$stage" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)

mkdir -p dist
npx --yes "$MCPB" pack "$stage" dist/ghost-mcp.mcpb
