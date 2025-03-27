import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { DiscordController } from "./controllers/discord.controller.ts";
import { DebugController } from "./controllers/debug.controller.ts";

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
  console.log("Server starting on http://localhost:8000");
  await serve(app.fetch, { port: 8000 });
}

export default app;
