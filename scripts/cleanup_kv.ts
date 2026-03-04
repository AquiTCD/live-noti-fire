/**
 * Deno KV クリーンアップスクリプト
 * 
 * 使い方:
 * deno run --allow-net --allow-env --unstable-kv scripts/cleanup_kv.ts [KV_URL]
 */

/**
 * KVデータのクリーンアップを実行
 */
export async function cleanup(kvUrl?: string) {
  const kv = await Deno.openKv(kvUrl);
  console.log("🚀 Starting KV Cleanup...");

  // 1. 旧形式の active_streams を削除 (永続的な管理のため)
  const activeStreamEntries = kv.list({ prefix: ["active_streams"] });
  let activeStreamCount = 0;
  for await (const entry of activeStreamEntries) {
    // 新形式は ["active_streams", "broadcasterId"] (length 2)
    // 旧形式は ["active_streams", "broadcasterId", "streamId"] (length 3)
    if (entry.key.length === 3) {
      await kv.delete(entry.key);
      console.log(`  🗑 Deleted old active stream record: ${JSON.stringify(entry.key)}`);
      activeStreamCount++;
    }
  }
  console.log(`✅ Cleaned up ${activeStreamCount} old active stream records.`);

  // 2. 指定された不審なギルドIDに関連するデータを削除
  const TARGET_GUILD_ID = "264606226850119685";
  console.log(`\n🔍 Searching for data related to Guild ID: ${TARGET_GUILD_ID}...`);

  // A. ギルド設定の削除 ["guild_id", guildId]
  const guildKey = ["guild_id", TARGET_GUILD_ID];
  const guildEntry = await kv.get(guildKey);
  if (guildEntry.value) {
    await kv.delete(guildKey);
    console.log(`  🗑 Deleted guild settings: ${JSON.stringify(guildKey)}`);
  }

  // B. 配信通知メッセージの削除 ["notification", broadcasterId, guildId]
  let notificationCount = 0;
  const notificationEntries = kv.list({ prefix: ["notification"] });
  for await (const entry of notificationEntries) {
    // key[2] が guild_id
    if (entry.key[2] === TARGET_GUILD_ID) {
      await kv.delete(entry.key);
      console.log(`  🗑 Deleted notification record: ${JSON.stringify(entry.key)}`);
      notificationCount++;
    }
  }
  if (notificationCount > 0) {
    console.log(`  ✅ Cleaned up ${notificationCount} notification records.`);
  }

  // C. Twitchユーザーとギルドのマッピングの更新・削除 ["broadcaster_id", twitchUserId]
  const broadcasterEntries = kv.list<string[]>({ prefix: ["broadcaster_id"] });
  for await (const entry of broadcasterEntries) {
    const twitchUserId = entry.key[1] as string;
    const guildIds = entry.value;

    if (guildIds.includes(TARGET_GUILD_ID)) {
      const updatedGuildIds = guildIds.filter(id => id !== TARGET_GUILD_ID);

      if (updatedGuildIds.length === 0) {
        // このTwitchユーザーが他に登録しているギルドがない場合、関連データ一式を削除

        // 1. マップ先のDiscordユーザーIDを取得
        const mappingKey = ["twitch_to_discord", twitchUserId];
        const discordIdEntry = await kv.get<string>(mappingKey);

        const atomic = kv.atomic();
        atomic.delete(entry.key); // ["broadcaster_id", twitchUserId]
        atomic.delete(mappingKey); // ["twitch_to_discord", twitchUserId]

        if (discordIdEntry.value) {
          atomic.delete(["users", discordIdEntry.value]); // ["users", discordUserId]
          console.log(`  🗑 Deleted user data for Discord ID: ${discordIdEntry.value} (Twitch ID: ${twitchUserId})`);
        }

        await atomic.commit();
        console.log(`  🗑 Deleted broadcaster mapping: ${JSON.stringify(entry.key)}`);
      } else {
        // 他に有効なギルドがある場合は、不審なギルドIDだけを除去して更新
        await kv.set(entry.key, updatedGuildIds);
        console.log(`  📝 Updated broadcaster mapping (removed target guild): ${JSON.stringify(entry.key)}`);
      }
    }
  }

  console.log("\n✨ KV Cleanup complete!");
  kv.close();
}

if (import.meta.main) {
  await cleanup(Deno.args[0]);
}
