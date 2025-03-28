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
  private static readonly CALLBACK_URL = "https://your-domain.com/webhook/twitch"; // TODO: 設定から取得

  private static accessToken: string | null = null;
  private static tokenExpiry: number | null = null;

  /**
   * Twitchのアクセストークンを取得
   */
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
  static async subscribeToStreamEvents(twitchUserId: string): Promise<boolean> {
    const events = ["stream.online", "stream.offline"];
    const results = await Promise.all(
      events.map(type => this.createEventSubscription(twitchUserId, type))
    );

    return results.every(result => result);
  }

  /**
   * 特定のイベントタイプのサブスクリプションを作成
   */
  private static async createEventSubscription(
    twitchUserId: string,
    type: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

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
            broadcaster_user_id: twitchUserId,
          },
          transport: {
            method: "webhook",
            callback: this.CALLBACK_URL,
            secret: crypto.randomUUID(), // 各サブスクリプションごとにユニークなシークレットを生成
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

      console.log(`Successfully subscribed to ${type} events for user ${twitchUserId}`);
      return true;

    } catch (error) {
      console.error(`Failed to subscribe to ${type} events:`, error);
      return false;
    }
  }
}
