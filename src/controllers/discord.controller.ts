import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import type { DiscordSlashCommand, UserRegistration, ApiResponse } from "../types/user.ts";
import { userRepository } from "../repositories/user.repository.ts";

export class DiscordController {
  /**
   * /live-register スラッシュコマンドの処理
   */
  static async handleLiveRegister(c: Context) {
    try {
      const command = await c.req.json() as DiscordSlashCommand;

      // コマンドのバリデーション
      if (command.data.name !== "live-register") {
        return c.json({
          error: "Invalid command",
        }, 400);
      }

      // DiscordユーザーIDの取得
      const discordUserId = command.member?.user.id;
      if (!discordUserId) {
        return c.json({
          error: "Discord user ID not found",
        }, 400);
      }

      // TwitchユーザーIDの取得（コマンドのオプションから）
      const twitchUserId = command.data.options?.find(opt => opt.name === "twitch_id")?.value;
      if (!twitchUserId) {
        return c.json({
          error: "Twitch user ID is required",
        }, 400);
      }

      // 既存の登録確認
      const existingUser = await userRepository.getByDiscordId(discordUserId);
      if (existingUser) {
        return c.json({
          error: "User already registered",
          data: existingUser,
        }, 400);
      }

      // 新規ユーザー登録
      const registration: UserRegistration = {
        discordUserId,
        twitchUserId,
        registeredAt: new Date().toISOString(),
        isSubscribed: false, // Twitchのサブスクリプション設定前
      };

      const success = await userRepository.register(registration);

      if (!success) {
        throw new Error("Failed to register user");
      }

      const response: ApiResponse<UserRegistration> = {
        message: "Registration successful",
        data: registration,
      };

      return c.json(response, 201);

    } catch (error: unknown) {
      console.error("Error in handleLiveRegister:", error);

      const response: ApiResponse<never> = {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      };

      return c.json(response, 500);
    }
  }
}
