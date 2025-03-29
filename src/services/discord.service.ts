import { getEnvVar } from "../types/env.ts";

interface DiscordInteractionOption {
  name: string;
  type: number;
  value: string;
}

interface DiscordInteraction {
  type: number;
  id: string;
  token: string;
  data: {
    name: string;
    options?: DiscordInteractionOption[];
  };
  user?: {
    id: string;
  };
  member?: {
    user: {
      id: string;
    };
  };
}

interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    flags?: number;
  };
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  image?: {
    url: string;
  };
  author?: {
    name: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface InteractionVerificationResult {
  isValid: boolean;
  interaction?: DiscordInteraction;
}

// Discord Interaction Type constants
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

// Discord Interaction Response Type constants
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

// Discord Message Flags
const MessageFlags = {
  EPHEMERAL: 64,
} as const;

/**
 * 16進数文字列をUint8Arrayに変換
 */
function hexToUint8Array(hex: string): Uint8Array {
  const pairs = hex.match(/[\dA-F]{2}/gi);
  if (!pairs) {
    throw new Error('Invalid hex string');
  }
  return new Uint8Array(
    pairs.map((byte) => parseInt(byte, 16))
  );
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
      // ED25519による署名検証
      const encoder = new TextEncoder();
      const signatureUint8 = hexToUint8Array(signature);
      const timestampBody = encoder.encode(timestamp + body);
      const publicKeyUint8 = hexToUint8Array(this.PUBLIC_KEY);

      // 公開鍵をインポート
      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyUint8,
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519'
        },
        true,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        signatureUint8,
        timestampBody
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
      type: InteractionResponseType.PONG
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
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: content.message,
        flags: content.error ? MessageFlags.EPHEMERAL : undefined,
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
   * チャンネルにembedメッセージを送信
   */
  static async sendEmbedMessage(channelId: string, content: string, embed: DiscordEmbed): Promise<string> {
    try {
      const response = await this.fetchDiscordApi(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          embeds: [embed]
        }),
      });
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("Error sending embed message:", error);
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
    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      return { valid: false, error: "Invalid interaction type" };
    }

    if (interaction.data.name !== "add-streamer") {
      return { valid: false, error: "Unknown command" };
    }

    // ユーザーIDはuser直下かmember.user内にある
    const userId = interaction.user?.id || interaction.member?.user.id;
    if (!userId) {
      return { valid: false, error: "User ID not found" };
    }

    const twitchId = interaction.data.options?.find(
      (opt: DiscordInteractionOption) => opt.name === "twitch_username"
    )?.value;

    if (!twitchId) {
      return { valid: false, error: "Twitch username is required" };
    }

    return {
      valid: true,
      userId,
      twitchId,
    };
  }
}
