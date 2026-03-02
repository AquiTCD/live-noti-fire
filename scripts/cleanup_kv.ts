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

  // 注意：あやしいギルドの削除ロジックは捜査（ログ出力）のため削除されました。
  // 犯人を特定してから手動で削除するか、捜査後に再度追加してください。

  console.log("\n✨ KV Cleanup complete!");
  kv.close();
}

if (import.meta.main) {
  await cleanup(Deno.args[0]);
}
