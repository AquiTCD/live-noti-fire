import { Hono } from "hono";
import { serve } from "std/http/server.ts";
import type { Context } from "hono";
import { DiscordController } from "./controllers/discord.controller.ts";
import { OAuthController } from "./controllers/oauth.controller.ts";
import { DebugController } from "./controllers/debug.controller.ts";
import { validateEnv } from "./types/env.ts";

const app = new Hono();

// OAuth2エンドポイント
app.get("/oauth/login", OAuthController.handleLogin);
app.get("/oauth/callback", OAuthController.handleCallback);

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
  // 起動時に環境変数をバリデーション
  const isValid = await validateEnv();
  if (!isValid) {
    console.error("Missing required environment variables. Server startup aborted.");
    console.error("Please check .env.example for required variables.");
    Deno.exit(1);
  }

  console.log("Server starting on http://localhost:8000");
  await serve(app.fetch, { port: 8000 });
}

export default app;
