import { Hono } from "hono";
import type { Context } from "hono";
import { DiscordController } from "./controllers/discord.controller";
import { DebugController } from "./controllers/debug.controller";
import { TwitchController } from "./controllers/twitch.controller";

const REQUIRED_ENV_VARS = [
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_BOT_TOKEN",
  "DISCORD_PUBLIC_KEY",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_SUBSCRIPTION_SECRET",
  "TWITCH_CALLBACK_URL",
  "X_CONSUMER_KEY",
  "X_CONSUMER_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_SECRET",
  "X_TARGET_TWITCH_ID",
] as const;

const app = new Hono<{ Bindings: Env }>();

// リクエスト受信時に必須の環境変数（secrets/vars）が揃っているか検証
// (ヘルスチェックは監視ツールが叩くため、secrets未設定でも200を返せるよう対象外にする)
const validateEnv = async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !c.env[key]);

  if (missingEnvVars.length > 0) {
    console.error("Missing required environment variables:", missingEnvVars);
    return c.json({ error: "Server misconfiguration: missing environment variables" }, 500);
  }

  await next();
};

// Discord エンドポイント
app.post("/discord/interactions", validateEnv, DiscordController.handleInteraction);
app.post("/discord/command_register", validateEnv, DiscordController.handleCommandRegister);

// Twitch エンドポイント
app.post("/twitch/webhooks", validateEnv, TwitchController.handleWebhook);

// デバッグ用エンドポイント（セキュリティのため、必要な時だけコメントアウトを外してください）
// app.get("/debug/kv", DebugController.showKvContents);
// app.delete("/debug/kv", DebugController.clearKvContents);
// app.post("/debug/kv/delete", DebugController.deleteKvEntry);

// Healthcheck エンドポイント
app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
  });
});

export default app;
