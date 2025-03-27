import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import type { UserRegistration, ApiResponse } from "../types/user.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { TwitchService } from "../services/twitch.service.ts";
import { DiscordService } from "../services/discord.service.ts";
import { validateEnv, getEnvVar } from "../types/env.ts";
import { GuildRepository } from "../repositories/guild.repository.ts";

interface DiscordInteraction {
  id: string;
  token: string;
  type: number;
  guild_id?: string;
  data: {
    name: string;
    options?: Array<{
      name: string;
      type: number;
      value: string;
    }>;
  };
}

export class DiscordController {
  private static readonly API_VERSION = "10";

  /**
   * スラッシュコマンドを登録
   */
  static async registerCommands() {
    const commands = [
      {
        name: "live-register",
        description: "Twitchの配信通知を登録します",
        options: [
          {
            name: "twitch_username",
            description: "Twitchのユーザー名",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: "live-notify",
        description: "配信通知を送信するチャンネルを設定します",
        options: [
          {
            name: "channel",
            description: "通知を送信するチャンネル",
            type: 7, // CHANNEL
            required: true,
          },
        ],
      },
    ];

    const applicationId = getEnvVar("DISCORD_CLIENT_ID");
    const botToken = getEnvVar("DISCORD_BOT_TOKEN");
    const url = `https://discord.com/api/v${this.API_VERSION}/applications/${applicationId}/commands`;

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to register commands: ${error}`);
      }

      console.log("Successfully registered global commands");
      return true;
    } catch (error) {
      console.error("Error registering global commands:", error);
      return false;
    }
  }

  /**
   * コマンド登録エンドポイントの処理
   */
  static async handleCommandRegister(c: Context) {
    try {
      const success = await DiscordController.registerCommands();

      if (!success) {
        return c.json({
          error: "Failed to register commands",
        }, 500);
      }

      return c.json({
        message: "Commands registered successfully",
        type: "global"
      }, 200);

    } catch (error) {
      console.error("Error in handleCommandRegister:", error);
      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }

  /**
   * テストメッセージ送信エンドポイントの処理
   */
  static async handleTest(c: Context) {
    try {
      const { guildId } = await c.req.json() as { guildId: string };

      if (!guildId) {
        return c.json({
          error: "Guild ID is required"
        }, 400);
      }

      const channelId = await GuildRepository.getNotifyChannel(guildId);
      if (!channelId) {
        return c.json({
          error: "Notification channel not set for this guild"
        }, 400);
      }

      const messageId = await DiscordService.sendMessage(channelId, "hello");

      return c.json({
        message: "Test message sent successfully",
        messageId
      }, 200);

    } catch (error) {
      console.error("Error in handleTest:", error);
      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }

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
      console.log("Received interaction:", interaction);

      // PING リクエストの処理
      if (interaction.type === 1) {
        return c.json(DiscordService.createPingResponse());
      }

      // コマンドの処理
      if (interaction.type === 2) {
        console.log("Received command:", interaction.data.name);
        if (interaction.data.name === "live-register") {
          return await DiscordController.handleLiveRegister(c);
        } else if (interaction.data.name === "live-notify") {
          return await DiscordController.handleLiveNotify(c, interaction);
        }
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

  /**
   * /live-notify スラッシュコマンドの処理
   */
  static async handleLiveNotify(c: Context, interaction: DiscordInteraction) {
    try {
      console.log("Received live-notify command");

      if (!interaction.guild_id) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "このコマンドはサーバー内でのみ使用できます。",
            error: true,
          }
        );
        return c.json({ error: "Guild ID not found" }, 400);
      }

      const channelOption = interaction.data.options?.find(opt => opt.name === "channel");
      if (!channelOption) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "チャンネルを指定してください。",
            error: true,
          }
        );
        return c.json({ error: "Channel not specified" }, 400);
      }

      const success = await GuildRepository.setNotifyChannel(
        interaction.guild_id,
        channelOption.value
      );

      if (!success) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "チャンネルの設定に失敗しました。",
            error: true,
          }
        );
        return c.json({ error: "Failed to set notify channel" }, 500);
      }

      await DiscordService.respondToInteraction(
        interaction.id,
        interaction.token,
        {
          message: "配信通知チャンネルを設定しました。",
          error: false,
        }
      );

      return c.json({
        message: "Notification channel set successfully",
        guildId: interaction.guild_id,
        channelId: channelOption.value,
      }, 200);

    } catch (error) {
      console.error("Error in handleLiveNotify:", error);

      if (interaction) {
        await DiscordService.respondToInteraction(
          interaction.id,
          interaction.token,
          {
            message: "エラーが発生しました。",
            error: true,
          }
        );
      }

      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
