/**
 * Cloudflare KV クリーンアップスクリプト
 *
 * 特定のギルドID（不正利用が疑われるサーバー）に紐づくデータをKVから一括削除する。
 * `wrangler kv key ...` CLI（wrangler.tomlの "KV" binding）経由で操作するため、
 * ローカル永続化ストア（--local、デフォルト）か本番KV（--remote）かを切り替えられる。
 *
 * 使い方:
 *   pnpm run cleanup-kv            # ローカルKVに対して実行
 *   pnpm run cleanup-kv -- --remote # 本番KVに対して実行（要 wrangler login）
 */
import { execFileSync } from "node:child_process";

const TARGET_GUILD_ID = "264606226850119685";

function runWranglerKv(args: string[], remote: boolean): string {
  return execFileSync(
    "wrangler",
    ["kv", ...args, "--binding=KV", remote ? "--remote" : "--local"],
    { encoding: "utf-8" }
  );
}

function listKeys(prefix: string, remote: boolean): string[] {
  const output = runWranglerKv(["key", "list", `--prefix=${prefix}`], remote);
  const entries = JSON.parse(output) as Array<{ name: string }>;
  return entries.map((entry) => entry.name);
}

function getValue(key: string, remote: boolean): string | null {
  try {
    return runWranglerKv(["key", "get", key], remote).trim();
  } catch {
    return null;
  }
}

function deleteKey(key: string, remote: boolean) {
  runWranglerKv(["key", "delete", key], remote);
  console.log(`  🗑 Deleted: ${key}`);
}

function putValue(key: string, value: string, remote: boolean) {
  runWranglerKv(["key", "put", key, value], remote);
  console.log(`  📝 Updated: ${key}`);
}

/**
 * KVデータのクリーンアップを実行
 */
export function cleanup(remote = false) {
  console.log(`🚀 Starting KV Cleanup (${remote ? "remote" : "local"})...`);
  console.log(`\n🔍 Searching for data related to Guild ID: ${TARGET_GUILD_ID}...`);

  // A. ギルド設定の削除 (guild_id:{guildId})
  const guildKey = `guild_id:${TARGET_GUILD_ID}`;
  if (getValue(guildKey, remote) !== null) {
    deleteKey(guildKey, remote);
  }

  // B. 配信通知メッセージの削除 (notification:{broadcasterId}:{guildId})
  let notificationCount = 0;
  for (const key of listKeys("notification:", remote)) {
    if (key.endsWith(`:${TARGET_GUILD_ID}`)) {
      deleteKey(key, remote);
      notificationCount++;
    }
  }
  if (notificationCount > 0) {
    console.log(`  ✅ Cleaned up ${notificationCount} notification records.`);
  }

  // C. Twitchユーザーとギルドのマッピングの更新・削除 (broadcaster_id:{twitchUserId})
  for (const key of listKeys("broadcaster_id:", remote)) {
    const raw = getValue(key, remote);
    if (!raw) continue;

    const guildIds = JSON.parse(raw) as string[];
    if (!guildIds.includes(TARGET_GUILD_ID)) continue;

    const twitchUserId = key.slice("broadcaster_id:".length);
    const updatedGuildIds = guildIds.filter((id) => id !== TARGET_GUILD_ID);

    if (updatedGuildIds.length === 0) {
      // このTwitchユーザーが他に登録しているギルドがない場合、関連データ一式を削除
      const mappingKey = `twitch_to_discord:${twitchUserId}`;
      const discordUserId = getValue(mappingKey, remote);

      deleteKey(key, remote);
      deleteKey(mappingKey, remote);

      if (discordUserId) {
        deleteKey(`users:${discordUserId}`, remote);
        console.log(`  🗑 Deleted user data for Discord ID: ${discordUserId} (Twitch ID: ${twitchUserId})`);
      }
    } else {
      // 他に有効なギルドがある場合は、不審なギルドIDだけを除去して更新
      putValue(key, JSON.stringify(updatedGuildIds), remote);
    }
  }

  console.log("\n✨ KV Cleanup complete!");
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  cleanup(process.argv.includes("--remote"));
}
