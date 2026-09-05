#!/usr/bin/env bash
#
# .env の値から、Cloudflare Workers の本番シークレットを一括登録する運用スクリプト。
#
# 対象は「本当にシークレットとして管理すべき値」のみ。X_POST_PREFIX や
# DISCORD_ALLOWED_GUILD_IDS、TWITCH_CALLBACK_URL のような非シークレットの
# 設定値は wrangler.toml の [vars] 側で管理しているため、ここでは対象外。
#
# 使い方:
#   pnpm run sync-secrets
#   pnpm run sync-secrets -- path/to/.env.production   # .env以外を使う場合

set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE が見つかりません" >&2
  exit 1
fi

node --eval '
const fs = require("fs");
const path = process.argv[1];

const keys = [
  "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN", "DISCORD_PUBLIC_KEY",
  "TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "TWITCH_SUBSCRIPTION_SECRET",
  "X_CONSUMER_KEY", "X_CONSUMER_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET", "X_TARGET_TWITCH_ID",
];

const env = Object.fromEntries(
  fs.readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eqIndex = line.indexOf("=");
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("\x27") && value.endsWith("\x27"))) {
        value = value.slice(1, -1);
      }
      return [key, value];
    })
);

const missing = keys.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error("Missing required keys in " + path + ":", missing);
  process.exit(1);
}

process.stdout.write(JSON.stringify(Object.fromEntries(keys.map((key) => [key, env[key]]))));
' "$ENV_FILE" | pnpm exec wrangler secret bulk
