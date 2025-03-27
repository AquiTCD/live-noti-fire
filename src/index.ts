import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { DiscordController } from "./controllers/discord.controller.ts";
import { DebugController } from "./controllers/debug.controller.ts";
import { validateEnv } from "./types/env.ts";

const app = new Hono();

// Discord スラッシュコマンドのエンドポイント
app.post("/discord/commands", DiscordController.handleLiveRegister);

// デバッグ用エンドポイント
app.get("/debug/kv", DebugController.showKvContents);

// Healthcheck エンドポイント
app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    uptime: Math.floor(performance.now() / 1000),
  });
});

if (import.meta.main) {
  // 起動時に環境変数をチェック
  if (!validateEnv()) {
    console.error("Missing required environment variables. Server startup aborted.");
    Deno.exit(1);
  }

  console.log("Server starting on http://localhost:8000");
  await serve(app.fetch, { port: 8000 });
}

export default app;
