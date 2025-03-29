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
app.post("/discord/test", DiscordController.handleTest);

// Twitch エンドポイント
app.post("/twitch/webhooks", TwitchController.handleWebhook);

// デバッグ用エンドポイント
app.get("/debug/kv", DebugController.showKvContents);
app.delete("/debug/kv", DebugController.clearKvContents);

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
  await serve(app.fetch, { port: 8000 });

  Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
  });
}

export default app;
