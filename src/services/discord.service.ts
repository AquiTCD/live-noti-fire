import { getEnvVar } from "../types/env.ts";

interface DiscordInteraction {
  type: number;
  data: {
    name: string;
    options?: Array<{
      name: string;
      type: number;
      value: string;
    }>;
  };
  user?: {
    id: string;
  };
}

interface InteractionResponse {
  type: number;
  data: {
    content: string;
    flags?: number;
  };
}

export class DiscordService {
  private static readonly API_VERSION = "10";
  private static readonly API_BASE = `https://discord.com/api/v${DiscordService.API_VERSION}`;
  private static readonly BOT_TOKEN = getEnvVar("DISCORD_CLIENT_SECRET");

  // Discordが必要とするIntents
  private static readonly INTENTS = {
    GUILDS: 1 << 0,
    GUILD_MESSAGES: 1 << 9,
    GUILD_MEMBERS: 1 << 1,
    MESSAGE_CONTENT: 1 << 15,
  };

  // 必要なIntentsの合計値
  private static readonly REQUIRED_INTENTS =
    DiscordService.INTENTS.GUILDS |
    DiscordService.INTENTS.GUILD_MESSAGES |
    DiscordService.INTENTS.GUILD_MEMBERS |
    DiscordService.INTENTS.MESSAGE_CONTENT;

  /**
   * Discord APIにリクエストを送信
   */
  private static async fetchDiscordApi(
    endpoint: string,
    options: RequestInit = {}
  ) {
    const url = `${this.API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bot ${this.BOT_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${error}`);
    }

    return response;
  }

  /**
   * スラッシュコマンドのレスポンスを送信
   */
  static async respondToInteraction(
    interactionId: string,
    interactionToken: string,
    content: { message: string; error?: boolean }
  ) {
    const response: InteractionResponse = {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: content.message,
        flags: content.error ? 64 : undefined, // EPHEMERAL flag
      },
    };

    try {
      await this.fetchDiscordApi(
        `/interactions/${interactionId}/${interactionToken}/callback`,
        {
          method: "POST",
          body: JSON.stringify(response),
        }
      );
    } catch (error) {
      console.error("Error sending interaction response:", error);
      throw error;
    }
  }

  /**
   * チャンネルにメッセージを送信
   */
  static async sendMessage(channelId: string, content: string): Promise<string> {
    try {
      const response = await this.fetchDiscordApi(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * メッセージにリアクションを追加
   */
  static async addReaction(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<boolean> {
    try {
      await this.fetchDiscordApi(
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
        { method: "PUT" }
      );
      return true;
    } catch (error) {
      console.error("Error adding reaction:", error);
      return false;
    }
  }

  /**
   * スラッシュコマンドのバリデーション
   */
  static validateCommand(interaction: DiscordInteraction): {
    valid: boolean;
    error?: string;
    userId?: string;
    twitchId?: string;
  } {
    if (interaction.type !== 2) { // APPLICATION_COMMAND
      return { valid: false, error: "Invalid interaction type" };
    }

    if (interaction.data.name !== "live-register") {
      return { valid: false, error: "Unknown command" };
    }

    const userId = interaction.user?.id;
    if (!userId) {
      return { valid: false, error: "User ID not found" };
    }

    const twitchId = interaction.data.options?.find(
      opt => opt.name === "twitch_id"
    )?.value;

    if (!twitchId) {
      return { valid: false, error: "Twitch ID is required" };
    }

    return {
      valid: true,
      userId,
      twitchId,
    };
  }
}
