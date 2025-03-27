import { getEnvVar } from "../types/env.ts";
import {
  APIInteraction,
  APIInteractionResponse,
  MessageFlags,
  APIApplicationCommandInteractionDataOption,
} from "discord-api-types/v10";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
  VerifyWithKeyParams,
} from "discord-interactions";

type DiscordInteraction = APIInteraction;
type InteractionResponse = APIInteractionResponse;

interface InteractionVerificationResult {
  isValid: boolean;
  interaction?: DiscordInteraction;
}

export class DiscordService {
  private static readonly API_VERSION = "10";
  private static readonly API_BASE = `https://discord.com/api/v${DiscordService.API_VERSION}`;
  private static readonly BOT_TOKEN = getEnvVar("DISCORD_BOT_TOKEN");

  private static readonly PUBLIC_KEY = getEnvVar("DISCORD_PUBLIC_KEY");

  /**
   * Interactionリクエストの検証
   */
  static async verifyInteraction(
    signature: string,
    timestamp: string,
    body: string
  ): Promise<InteractionVerificationResult> {
    try {
      const isValid = await verifyKey(
        body,
        signature,
        timestamp,
        this.PUBLIC_KEY
      );

      if (!isValid) {
        return { isValid: false };
      }

      const interaction = JSON.parse(body) as DiscordInteraction;
      return { isValid: true, interaction };
    } catch (error) {
      console.error("Error verifying interaction:", error);
      return { isValid: false };
    }
  }

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
   * PINGリクエストに対する応答を生成
   */
  static createPingResponse(): InteractionResponse {
    return {
      type: InteractionType.Pong
    };
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
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: content.message,
        flags: content.error ? MessageFlags.Ephemeral : undefined,
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
    if (interaction.type !== InteractionType.ApplicationCommand) {
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
      (opt: APIApplicationCommandInteractionDataOption) => opt.name === "twitch_id"
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
