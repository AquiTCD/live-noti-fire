import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import type { DiscordSlashCommand, UserRegistration, ApiResponse } from "../types/user.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { TwitchService } from "../services/twitch.service.ts";
import { validateEnv } from "../types/env.ts";

export class DiscordController {
  /**
   * /live-register スラッシュコマンドの処理
   */
  static async handleLiveRegister(c: Context) {
    try {
      // 環境変数のバリデーション
      if (!validateEnv()) {
        throw new Error("Required environment variables are missing");
      }

      const command = await c.req.json() as DiscordSlashCommand;

      // コマンドのバリデーション
      if (command.data.name !== "live-register") {
        return c.json({
          error: "Invalid command",
          details: "This endpoint only accepts 'live-register' command",
        }, 400);
      }

      // DiscordユーザーIDの取得
      const discordUserId = command.member?.user.id;
      if (!discordUserId) {
        return c.json({
          error: "Discord user ID not found",
          details: "Command must be used in a server, not in DMs",
        }, 400);
      }

      // TwitchユーザーIDの取得（コマンドのオプションから）
      const twitchUserId = command.data.options?.find(opt => opt.name === "twitch_id")?.value;
      if (!twitchUserId) {
        return c.json({
          error: "Twitch user ID is required",
          details: "Please provide your Twitch user ID using the 'twitch_id' option",
        }, 400);
      }

      // 既存の登録確認
      const existingUser = await userRepository.getByDiscordId(discordUserId);
      if (existingUser) {
        return c.json({
          error: "User already registered",
          details: "This Discord user is already registered with a Twitch account",
          data: existingUser,
        }, 400);
      }

      // 新規ユーザー登録
      const registration: UserRegistration = {
        discordUserId,
        twitchUserId,
        registeredAt: new Date().toISOString(),
        isSubscribed: false,
      };

      // ユーザー情報の保存
      const registrationSuccess = await userRepository.register(registration);
      if (!registrationSuccess) {
        throw new Error("Failed to register user in database");
      }

      // Twitchイベントのサブスクリプション
      const subscriptionSuccess = await TwitchService.subscribeToStreamEvents(twitchUserId);

      if (!subscriptionSuccess) {
        // サブスクリプション失敗時は登録を維持しつつ、状態を更新
        await userRepository.updateSubscriptionStatus(discordUserId, false);

        return c.json({
          message: "Partial success: User registered but Twitch subscription failed",
          details: "You are registered but we couldn't subscribe to Twitch events. Please try again later or contact support.",
          data: {
            ...registration,
            isSubscribed: false,
          }
        }, 201);
      }

      // 登録完了とサブスクリプション成功
      await userRepository.updateSubscriptionStatus(discordUserId, true);
      const response: ApiResponse<UserRegistration> = {
        message: "Registration successful",
        details: "Successfully registered and subscribed to Twitch stream events",
        data: {
          ...registration,
          isSubscribed: true,
        },
      };

      return c.json(response, 201);

    } catch (error: unknown) {
      console.error("Error in handleLiveRegister:", error);

      const response: ApiResponse<never> = {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "An unexpected error occurred",
      };

      return c.json(response, 500);
    }
  }
}
