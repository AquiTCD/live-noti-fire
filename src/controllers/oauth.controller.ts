import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { getEnvVar } from "../types/env.ts";

interface OAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class OAuthController {
  private static readonly DISCORD_API_VERSION = "10";
  private static readonly REDIRECT_URI = "http://localhost:8000/oauth/callback"; // TODO: 環境変数化

  /**
   * OAuth2認証ページへのリダイレクト
   */
  static async handleLogin(c: Context) {
    const clientId = getEnvVar("DISCORD_CLIENT_ID");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.REDIRECT_URI,
      response_type: "code",
      scope: "bot applications.commands",
    });

    return c.redirect(
      `https://discord.com/oauth2/authorize?${params.toString()}`
    );
  }

  /**
   * OAuth2コールバックの処理
   */
  static async handleCallback(c: Context) {
    try {
      const { code } = c.req.query();

      if (!code) {
        return this.renderError(c, "Authorization code not found.");
      }

      // OAuth2トークンの取得
      const tokenResponse = await this.exchangeCode(code);
      if (!tokenResponse) {
        return this.renderError(c, "Failed to get access token.");
      }

      // アプリケーションコマンドの登録
      const success = await this.registerCommands(tokenResponse.access_token);

      if (success) {
        return this.renderSuccess(c);
      } else {
        return this.renderError(c, "Failed to register commands.");
      }

    } catch (error) {
      console.error("OAuth callback error:", error);
      return this.renderError(c, "An unexpected error occurred.");
    }
  }

  /**
   * OAuth2トークンの取得
   */
  private static async exchangeCode(code: string): Promise<OAuthResponse | null> {
    try {
      const clientId = getEnvVar("DISCORD_CLIENT_ID");
      const clientSecret = getEnvVar("DISCORD_CLIENT_SECRET");

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.REDIRECT_URI,
      });

      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!response.ok) {
        throw new Error(`Failed to exchange code: ${response.statusText}`);
      }

      return await response.json() as OAuthResponse;
    } catch (error) {
      console.error("Error exchanging code:", error);
      return null;
    }
  }

  /**
   * スラッシュコマンドの登録
   */
  private static async registerCommands(accessToken: string): Promise<boolean> {
    try {
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
      const url = `https://discord.com/api/v${this.DISCORD_API_VERSION}/applications/${applicationId}/commands`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
      });

      if (!response.ok) {
        throw new Error(`Failed to register commands: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error("Error registering commands:", error);
      return false;
    }
  }

  /**
   * 成功画面の表示
   */
  private static renderSuccess(c: Context) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Setup Complete</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 600px;
              margin: 2rem auto;
              padding: 0 1rem;
              text-align: center;
              line-height: 1.5;
            }
            .success { color: #28a745; }
            .command {
              background: #f8f9fa;
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <h1>✅ Setup Complete</h1>
          <p class="success">Botのセットアップが完了しました！</p>
          <p>サーバーで <span class="command">/live-register</span> コマンドが使用できます。</p>
          <p>このページは閉じていただいて構いません。</p>
        </body>
      </html>
    `);
  }

  /**
   * エラー画面の表示
   */
  private static renderError(c: Context, message: string) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Setup Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              max-width: 600px;
              margin: 2rem auto;
              padding: 0 1rem;
              text-align: center;
              line-height: 1.5;
            }
            .error { color: #dc3545; }
          </style>
        </head>
        <body>
          <h1>❌ Setup Failed</h1>
          <p class="error">${message}</p>
          <p>もう一度お試しいただくか、管理者にお問い合わせください。</p>
        </body>
      </html>
    `);
  }
}
