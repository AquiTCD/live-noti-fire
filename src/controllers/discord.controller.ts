import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import type { UserRegistration, ApiResponse } from "../types/user.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { TwitchService } from "../services/twitch.service.ts";
import { DiscordService } from "../services/discord.service.ts";
import { validateEnv } from "../types/env.ts";

export class DiscordController {
  /**
   * Discord Interactions エンドポイントの処理
   */
  static async handleInteraction(c: Context) {
    try {
      const signature = c.req.header('x-signature-ed25519');
      const timestamp = c.req.header('x-signature-timestamp');
      const rawBody = await c.req.text();

      if (!signature || !timestamp) {
        return c.json({ error: "Missing request headers" }, 401);
      }

      const verification = await DiscordService.verifyInteraction(
        signature,
        timestamp,
        rawBody
      );

      if (!verification.isValid) {
        return c.json({ error: "Invalid request signature" }, 401);
      }

      const interaction = verification.interaction;
      if (!interaction) {
        return c.json({ error: "Invalid interaction data" }, 400);
      }

      // PING リクエストの処理
      if (interaction.type === 1) {
        return c.json(DiscordService.createPingResponse());
      }

      // コマンドの処理
      if (interaction.type === 2) {
        return await this.handleLiveRegister(c);
      }

      return c.json({ error: "Invalid interaction type" }, 400);
    } catch (error) {
      console.error("Error handling interaction:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  /**
   * /live-register スラッシュコマンドの処理
   */
  static async handleLiveRegister(c: Context) {
    try {
      // 環境変数のバリデーション
      if (!validateEnv()) {
        throw new Error("Required environment variables are missing");
      }

      const interaction = await c.req.json();
      const validation = DiscordService.validateCommand(interaction);

      if (!validation.valid || !validation.userId || !validation.twitchId) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: validation.error || "Invalid command",
            error: true,
          }
        );

        return c.json({ error: validation.error }, 400);
      }

      // 既存の登録確認
      const existingUser = await userRepository.getByDiscordId(validation.userId);
      if (existingUser) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "このDiscordアカウントは既に登録されています。",
            error: true,
          }
        );

        return c.json({
          error: "User already registered",
          data: existingUser,
        }, 400);
      }

      // 新規ユーザー登録
      const registration: UserRegistration = {
        discordUserId: validation.userId,
        twitchUserId: validation.twitchId,
        registeredAt: new Date().toISOString(),
        isSubscribed: false,
      };

      // ユーザー情報の保存
      const registrationSuccess = await userRepository.register(registration);
      if (!registrationSuccess) {
        throw new Error("Failed to register user in database");
      }

      // Twitchイベントのサブスクリプション
      const subscriptionSuccess = await TwitchService.subscribeToStreamEvents(validation.twitchId);

      if (!subscriptionSuccess) {
        // サブスクリプション失敗時は登録を維持しつつ、状態を更新
        await userRepository.updateSubscriptionStatus(validation.userId, false);

        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "登録は完了しましたが、Twitchイベントの設定に失敗しました。しばらく経ってから再度お試しください。",
            error: true,
          }
        );

        return c.json({
          message: "Partial success: User registered but Twitch subscription failed",
          data: {
            ...registration,
            isSubscribed: false,
          }
        }, 201);
      }

      // 登録完了とサブスクリプション成功
      await userRepository.updateSubscriptionStatus(validation.userId, true);

      await DiscordService.respondToInteraction(
        interaction.id,
        interaction.token,
        {
          message: "登録が完了しました！配信開始時に通知が送られます。",
          error: false,
        }
      );

      const response: ApiResponse<UserRegistration> = {
        message: "Registration successful",
        data: {
          ...registration,
          isSubscribed: true,
        },
      };

      return c.json(response, 201);

    } catch (error: unknown) {
      console.error("Error in handleLiveRegister:", error);

      if ('id' in (await c.req.json())) {
        await DiscordService.respondToInteraction(
          (await c.req.json()).id,
          (await c.req.json()).token,
          {
            message: "エラーが発生しました。しばらく経ってから再度お試しください。",
            error: true,
          }
        );
      }

      const response: ApiResponse<never> = {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "An unexpected error occurred",
      };

      return c.json(response, 500);
    }
  }
}
