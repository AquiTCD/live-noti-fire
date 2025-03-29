import { getEnvVar } from "../types/env.ts";

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
  }>;
}

interface TwitchEventSubResponse {
  data?: {
    id: string;
  };
  error?: string;
}

interface TwitchAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class TwitchService {
  private static readonly TWITCH_API_URL = "https://api.twitch.tv/helix";
  private static readonly TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";
  private static readonly EVENTSUB_URL = `${this.TWITCH_API_URL}/eventsub/subscriptions`;
  private static readonly CALLBACK_URL = "https://live-noti-fire.deno.dev/twitch/webhooks";
  private static readonly SECRET_PREFIX = "twitch_secret";

  private static accessToken: string | null = null;
  private static tokenExpiry: number | null = null;
  private static kv: Deno.Kv;

  static {
    const initKv = async () => {
      this.kv = await Deno.openKv();
    };
    initKv();
  }

  /**
   * EventSubのシークレットを保存
   */
  private static async saveSecret(broadcasterId: string, secret: string): Promise<boolean> {
    try {
      const key = [this.SECRET_PREFIX, broadcasterId];
      const result = await this.kv.set(key, secret);
      return result.ok;
    } catch (error) {
      console.error("Error saving secret:", error);
      return false;
    }
  }

  /**
   * EventSubのシークレットを取得
   */
  private static async getSecret(broadcasterId: string): Promise<string | null> {
    try {
      const key = [this.SECRET_PREFIX, broadcasterId];
      const result = await this.kv.get<string>(key);
      return result.value;
    } catch (error) {
      console.error("Error getting secret:", error);
      return null;
    }
  }

  /**
   * Webhookリクエストの署名を検証
   */
  static async verifyWebhookRequest(
    messageId: string,
    timestamp: string,
    signature: string,
    broadcasterId: string,
    body: string
  ): Promise<boolean> {
    try {
      const secret = await this.getSecret(broadcasterId);
      if (!secret) {
        console.error(`No secret found for broadcaster ${broadcasterId}`);
        return false;
      }

      const message = messageId + timestamp + body;
      const computedSignature = `sha256=${
        await this.computeHmac(message, secret)
      }`;

      return computedSignature === signature;
    } catch (error) {
      console.error("Error verifying webhook request:", error);
      return false;
    }
  }

  /**
   * HMAC-SHA256の計算
   */
  private static async computeHmac(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * TwitchのユーザーIDを取得
   */
  static async getBroadcasterId(username: string): Promise<string | null> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${this.TWITCH_API_URL}/users?login=${username}`,
        {
          headers: {
            "Client-ID": getEnvVar("TWITCH_CLIENT_ID"),
            "Authorization": `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get user data: ${response.statusText}`);
      }

      const data = await response.json() as TwitchUserResponse;

      if (!data.data || data.data.length === 0) {
        return null;
      }

      return data.data[0].id;
    } catch (error) {
      console.error("Error getting broadcaster ID:", error);
      return null;
    }
  }

  private static async getAccessToken(): Promise<string> {
    // 既存のトークンが有効な場合は再利用
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const params = new URLSearchParams({
        client_id: getEnvVar("TWITCH_CLIENT_ID"),
        client_secret: getEnvVar("TWITCH_CLIENT_SECRET"),
        grant_type: "client_credentials",
      });

      const response = await fetch(`${this.TWITCH_AUTH_URL}?${params}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json() as TwitchAuthResponse;

      // トークンとその有効期限を保存（有効期限の10分前に更新）
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 600) * 1000;

      return this.accessToken;

    } catch (error) {
      console.error("Error getting Twitch access token:", error);
      throw error;
    }
  }

  /**
   * Twitchのストリーム開始/終了イベントをサブスクライブ
   */
  static async subscribeToStreamEvents(broadcasterId: string): Promise<boolean> {
    const events = ["stream.online", "stream.offline"];
    const results = await Promise.all(
      events.map(type => this.createEventSubscription(broadcasterId, type))
    );

    return results.every(result => result);
  }

  /**
   * 特定のイベントタイプのサブスクリプションを作成
   */
  private static async createEventSubscription(
    broadcasterId: string,
    type: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const secret = crypto.randomUUID();

      const response = await fetch(this.EVENTSUB_URL, {
        method: "POST",
        headers: {
          "Client-ID": getEnvVar("TWITCH_CLIENT_ID"),
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          version: "1",
          condition: {
            broadcaster_user_id: broadcasterId,
          },
          transport: {
            method: "webhook",
            callback: this.CALLBACK_URL,
            secret: secret,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to subscribe to ${type}: ${error}`);
      }

      const result = await response.json() as TwitchEventSubResponse;

      if (result.error) {
        throw new Error(`Twitch API error: ${result.error}`);
      }

      // シークレットを保存
      await this.saveSecret(broadcasterId, secret);

      console.log(`Successfully subscribed to ${type} events for user ${broadcasterId}`);
      return true;

    } catch (error) {
      console.error(`Failed to subscribe to ${type} events:`, error);
      return false;
    }
  }
}
