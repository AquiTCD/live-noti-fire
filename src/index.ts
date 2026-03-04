import { Hono } from "hono";
import { serve } from "std/http/server.ts";
import type { Context } from "hono";
import { DiscordController } from "./controllers/discord.controller.ts";
import { DebugController } from "./controllers/debug.controller.ts";
import { TwitchController } from "./controllers/twitch.controller.ts";
import { validateEnv } from "./types/env.ts";

const app = new Hono();

// Discord エンドポイント
app.post("/discord/interactions", DiscordController.handleInteraction);
app.post("/discord/command_register", DiscordController.handleCommandRegister);

// Twitch エンドポイント
app.post("/twitch/webhooks", TwitchController.handleWebhook);

// デバッグ用エンドポイント（セキュリティのため、必要な時だけコメントアウトを外してください）
// app.get("/debug/kv", DebugController.showKvContents);
// app.delete("/debug/kv", DebugController.clearKvContents);
// app.post("/debug/kv/delete", DebugController.deleteKvEntry);

// Healthcheck エンドポイント
app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    uptime: Math.floor(performance.now() / 1000),
  });
});

if (import.meta.main) {
  // 起動時に環境変数をバリデーション
  const isValid = await validateEnv();
  if (!isValid) {
    console.error("Missing required environment variables. Server startup aborted.");
    console.error("Please check .env.example for required variables.");
    Deno.exit(1);
  }

  console.log("Server starting on http://localhost:8000");

  // デプロイ時の1回限りのタスク（タイムアウト回避のためバックグラウンドで実行）
  // 注意: cron形式だが、実質的に一度実行されたら完了する設計。
  // 今回の不審なギルドデータの削除もここから発火されます。
  Deno.cron("One-time KV Cleanup Task", "*/1 * * * *", async () => {
    try {
      console.log("⏳ Starting background KV cleanup...");
      const { cleanup } = await import("../scripts/cleanup_kv.ts");
      await cleanup();
      console.log("✨ Background KV cleanup complete!");
    } catch (error) {
      console.error("❌ Failed to run background cleanup task:", error);
    }
  });

  await serve(app.fetch, { port: 8000 });
}

export default app;
