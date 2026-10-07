#!/usr/bin/env bash
# Builds dist/ghost-mcp.mcpb, a Claude Desktop extension. Desktop stores the sensitive
# settings (the API key) in the OS keychain instead of a plain-text config file.
set -euo pipefail

# Pinned, and run with pnpm dlx rather than installed: the CLI's own dependencies have open
# advisories (in signing and interactive prompts, neither used here) that would otherwise
# show up in this project's pnpm audit.
MCPB="@anthropic-ai/mcpb@2.1.2"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

package_version="$(node -p 'require("./package.json").version')"
manifest_version="$(node -p 'require("./manifest.json").version')"
if [[ "$package_version" != "$manifest_version" ]]; then
    echo "manifest.json version ($manifest_version) doesn't match package.json ($package_version)" >&2
    exit 1
fi

pnpm run build

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp -r build package.json pnpm-lock.yaml manifest.json LICENSE "$stage/"
# Hoisted: a flat node_modules with no symlinks into a store, so the bundle is self-contained.
(cd "$stage" && pnpm install --prod --frozen-lockfile --ignore-scripts --config.node-linker=hoisted)

mkdir -p dist
pnpm dlx "$MCPB" pack "$stage" dist/ghost-mcp.mcpb
