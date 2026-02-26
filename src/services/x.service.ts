import { getEnvVar } from "../types/env.ts";

export class XService {
  private static readonly X_API_URL = "https://api.twitter.com/2/tweets";

  /**
   * 配信開始をツイートする
   */
  static async postStreamTweet(title: string, url: string, gameName?: string): Promise<boolean> {
    try {
      const prefix = this.getPrefix();

      let text = `${prefix}\n${title}`;
      if (gameName && gameName !== "未設定") {
        // ハッシュタグにするためスペースを除去
        const hashtag = gameName.replace(/\s+/g, "");
        text += `\n#${hashtag}`;
      }
      text += `\n\n${url}`;

      console.log(`Posting to X:\n${text}`);

      const response = await this.postTweet(text.trim());
      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to post to X: ${error}`);
        return false;
      }

      console.log("Successfully posted to X");
      return true;
    } catch (error) {
      console.error("Error in postStreamTweet:", error);
      return false;
    }
  }

  private static getPrefix(): string {
    try {
      return Deno.env.get("X_POST_PREFIX") || "【ライブ配信開始】";
    } catch {
      return "【ライブ配信開始】";
    }
  }

  /**
   * X API v2でツイートを投稿する (OAuth 1.0a)
   */
  private static async postTweet(text: string): Promise<Response> {
    const method = "POST";
    const url = this.X_API_URL;
    const body = { text };

    const consumerKey = getEnvVar("X_CONSUMER_KEY");
    const consumerSecret = getEnvVar("X_CONSUMER_SECRET");
    const accessToken = getEnvVar("X_ACCESS_TOKEN");
    const accessSecret = getEnvVar("X_ACCESS_SECRET");

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: "1.0",
    };

    // 署名の生成
    const signature = await this.generateSignature(
      method,
      url,
      oauthParams,
      consumerSecret,
      accessSecret
    );

    oauthParams.oauth_signature = signature;

    // Authorizationヘッダーの構築
    const authHeader = "OAuth " + Object.entries(oauthParams)
      .sort()
      .map(([k, v]) => `${this.rfc3986Encode(k)}="${this.rfc3986Encode(v)}"`)
      .join(", ");

    return await fetch(url, {
      method,
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * OAuth 1.0a 署名の生成
   */
  private static async generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string
  ): Promise<string> {
    // 1. パラメータの正規化
    const encodedParams = Object.entries(params)
      .map(([k, v]) => [this.rfc3986Encode(k), this.rfc3986Encode(v)])
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    // 2. シグネチャベース文字列の構築
    const baseString = [
      method.toUpperCase(),
      this.rfc3986Encode(url),
      this.rfc3986Encode(encodedParams),
    ].join("&");

    // 3. 署名キーの構築
    const signingKey = `${this.rfc3986Encode(consumerSecret)}&${this.rfc3986Encode(tokenSecret)}`;

    // 4. HMAC-SHA1の計算
    return await this.computeHmacSha1(baseString, signingKey);
  }

  private static rfc3986Encode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  private static async computeHmacSha1(message: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    // Base64エンコード
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
}
