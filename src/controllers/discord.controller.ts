import type { Context } from "hono";
import type { UserRegistration, ApiResponse } from "../types/user";
import { userRepository } from "../repositories/user.repository";
import { TwitchService } from "../services/twitch.service";
import { DiscordService, type DiscordInteraction } from "../services/discord.service";
import { GuildRepository } from "../repositories/guild.repository";

type AppContext = Context<{ Bindings: Env }>;

const SLASH_COMMANDS = [
  {
    name: "add-streamer",
    description: "Twitchストリーマーの配信通知を登録します",
    options: [
      {
        name: "twitch_username",
        description: "Twitchのユーザー名",
        type: 3, // STRING
        required: true,
      },
      {
        name: "user",
        description: "代理登録する場合、実際の配信者を指定してください（省略時はコマンドを打った本人）",
        type: 6, // USER
        required: false,
      },
    ],
  },
  {
    name: "notify-settings",
    description: "配信通知の設定を行います",
    options: [
      {
        name: "channel",
        description: "通知を送信するチャンネル",
        type: 7, // CHANNEL
        required: true,
      },
      {
        name: "rules",
        description: "通知ルール（カンマ区切りで複数指定可）",
        type: 3, // STRING
        required: false,
      },
    ],
  },
];

export class DiscordController {
  /**
   * コマンド登録エンドポイントの処理
   */
  static async handleCommandRegister(c: AppContext) {
    try {
      const success = await DiscordService.registerGlobalCommands(c.env, SLASH_COMMANDS);

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
   * Discord Interactions エンドポイントの処理
   */
  static async handleInteraction(c: AppContext) {
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
        rawBody,
        c.env.DISCORD_PUBLIC_KEY
      );

      if (!verification.isValid) {
        return c.json({ error: "Invalid request signature" }, 401);
      }

      const interaction = verification.interaction;
      if (!interaction) {
        return c.json({ error: "Invalid interaction data" }, 400);
      }
      console.log("Received interaction:", interaction);

      // 捜査用ログ：誰がどこでコマンドを打ったか
      if (interaction.guild_id) {
        await DiscordService.logInvestigativeInfo(c.env, interaction.guild_id, interaction.channel_id);
      }

      // ギルドIDのホワイトリストチェック
      if (interaction.type !== 1 && !DiscordService.isAllowedGuild(c.env, interaction.guild_id)) {
        console.warn(`Unauthorized access attempt: guild_id=${interaction.guild_id}, type=${interaction.type}`);
        await DiscordService.respondToInteraction(
          c.env,
          interaction.id,
          interaction.token,
          {
            message: "このサーバー（またはDM）ではこのボットの使用は許可されていません。管理者に問い合わせてください。",
            error: true,
          }
        );
        return c.json({ error: "Unauthorized access" }, 403);
      }

      // PING リクエストの処理
      if (interaction.type === 1) {
        return c.json(DiscordService.createPingResponse());
      }

      // コマンドの処理
      if (interaction.type === 2) {
        console.log("Received command:", interaction.data.name);
        if (interaction.data.name === "add-streamer") {
          return await DiscordController.handleAddStreamer(c, interaction);
        } else if (interaction.data.name === "notify-settings") {
          return await DiscordController.handleNotifySettings(c, interaction);
        }
      }

      return c.json({ error: "Invalid interaction type" }, 400);
    } catch (error) {
      console.error("Error handling interaction:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  /**
   * /add-streamer スラッシュコマンドの処理
   */
  static async handleAddStreamer(c: AppContext, interaction: DiscordInteraction) {
    const env = c.env;
    const respond = (message: string, error = false) =>
      DiscordService.respondToInteraction(env, interaction.id, interaction.token, { message, error });

    try {
      const validation = DiscordService.validateCommand(interaction);

      if (!validation.valid || !validation.userId || !validation.twitchId) {
        await respond(validation.error || "Invalid command", true);
        return c.json({ error: validation.error }, 400);
      }

      // ギルドIDが必要
      if (!interaction.guild_id) {
        await respond("このコマンドはサーバー内でのみ使用できます。", true);
        return c.json({ error: "Guild ID not found" }, 400);
      }

      // Twitchユーザー名からIDを取得
      const twitchUserId = await TwitchService.getBroadcasterId(env, validation.twitchId);
      if (!twitchUserId) {
        await respond("指定されたTwitchユーザーが見つかりません。", true);
        return c.json({ error: "Twitch user not found" }, 400);
      }

      // ユーザー情報の保存
      const registrationSuccess = await userRepository.register(
        env.KV,
        twitchUserId,
        validation.userId,
        interaction.guild_id
      );
      if (!registrationSuccess) {
        throw new Error("Failed to register user in database");
      }

      // Twitchイベントのサブスクリプション
      const subscriptionSuccess = await TwitchService.subscribeToStreamEvents(env, twitchUserId);

      if (!subscriptionSuccess) {
        // サブスクリプション失敗時は登録を維持しつつ、状態を更新
        await userRepository.updateSubscriptionStatus(env.KV, validation.userId, false);
        await respond("登録は完了しましたが、Twitchイベントの設定に失敗しました。しばらく経ってから再度お試しください。", true);

        return c.json({
          message: "Partial success: User registered but Twitch subscription failed",
          data: {
            twitchUserId: twitchUserId,
            guildId: interaction.guild_id,
            isSubscribed: false,
          }
        }, 201);
      }

      // 登録完了とサブスクリプション成功
      await userRepository.updateSubscriptionStatus(env.KV, validation.userId, true);
      await respond("登録が完了しました！配信開始時に通知が送られます。");

      const response: ApiResponse<{
        twitchUserId: string;
        guildId: string;
        isSubscribed: boolean;
      }> = {
        message: "Registration successful",
        data: {
          twitchUserId: twitchUserId,
          guildId: interaction.guild_id,
          isSubscribed: true,
        },
      };

      return c.json(response, 201);
    } catch (error: unknown) {
      console.error("Error in handleAddStreamer:", error);
      await respond("エラーが発生しました。しばらく経ってから再度お試しください。", true);

      const response: ApiResponse<never> = {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "An unexpected error occurred",
      };

      return c.json(response, 500);
    }
  }

  /**
   * /notify-settings スラッシュコマンドの処理
   */
  static async handleNotifySettings(c: AppContext, interaction: DiscordInteraction) {
    const env = c.env;
    const respond = (message: string, error = false) =>
      DiscordService.respondToInteraction(env, interaction.id, interaction.token, { message, error });

    try {
      console.log("Received notify-settings command");

      if (!interaction.guild_id) {
        await respond("このコマンドはサーバー内でのみ使用できます。", true);
        return c.json({ error: "Guild ID not found" }, 400);
      }

      const channelOption = interaction.data.options?.find(opt => opt.name === "channel");
      if (!channelOption) {
        await respond("チャンネルを指定してください。", true);
        return c.json({ error: "Channel not specified" }, 400);
      }

      const rulesOption = interaction.data.options?.find(opt => opt.name === "rules");
      let rules: string[] | undefined;

      if (rulesOption?.value) {
        rules = rulesOption.value.split(',').map(rule => rule.trim()).filter(rule => rule.length > 0);
      }

      const success = await GuildRepository.setNotifyChannel(
        env.KV,
        interaction.guild_id,
        channelOption.value,
        rules
      );

      if (!success) {
        await respond("チャンネルの設定に失敗しました。", true);
        return c.json({ error: "Failed to set notify channel" }, 500);
      }

      await respond("配信通知チャンネルを設定しました。");

      return c.json({
        message: "Notification channel set successfully",
        guildId: interaction.guild_id,
        channelId: channelOption.value,
      }, 200);

    } catch (error) {
      console.error("Error in handleLiveNotify:", error);

      if (interaction) {
        await respond("エラーが発生しました。", true);
      }

      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
