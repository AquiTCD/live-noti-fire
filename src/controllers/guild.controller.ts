import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { getEnvVar } from "../types/env.ts";

interface GuildCreateEvent {
  t: "GUILD_CREATE";
  d: {
    id: string;
    name: string;
  };
}

const DISCORD_API_VERSION = "10";

/**
 * サーバー固有のスラッシュコマンドを登録
 */
async function registerGuildCommands(guildId: string) {
  const commands = [
    {
      name: "live-register",
      description: "Twitchの配信通知を登録します",
      options: [
        {
          name: "twitch_id",
          description: "TwitchのユーザーID",
          type: 3, // STRING
          required: true,
        },
      ],
    },
  ];

  const applicationId = getEnvVar("DISCORD_CLIENT_ID");
  const botToken = getEnvVar("DISCORD_BOT_TOKEN");
  const url = `https://discord.com/api/v${DISCORD_API_VERSION}/applications/${applicationId}/guilds/${guildId}/commands`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register guild commands: ${error}`);
    }

    console.log(`Successfully registered commands for guild ${guildId}`);
    return true;
  } catch (error) {
    console.error(`Error registering guild commands for ${guildId}:`, error);
    return false;
  }
}

export class GuildController {
  /**
   * GUILD_CREATEイベントの処理
   */
  static async handleGuildCreate(c: Context) {
    try {
      const event = await c.req.json() as GuildCreateEvent;

      // イベントタイプの確認
      if (event.t !== "GUILD_CREATE") {
        return c.json({ error: "Invalid event type" }, 400);
      }

      // コマンドの登録
      const success = await registerGuildCommands(event.d.id);

      if (!success) {
        return c.json({
          error: "Failed to register commands",
          guildId: event.d.id,
        }, 500);
      }

      return c.json({
        message: "Commands registered successfully",
        guildId: event.d.id,
      }, 200);

    } catch (error) {
      console.error("Error in handleGuildCreate:", error);
      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
