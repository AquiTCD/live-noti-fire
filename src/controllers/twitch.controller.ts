import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { GuildRepository } from "../repositories/guild.repository.ts";
import { DiscordService } from "../services/discord.service.ts";

interface StreamOnlineEvent {
  subscription: {
    type: string;
  };
  event: {
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type: string;
    started_at: string;
    title?: string;
  };
}

export class TwitchController {
  /**
   * Webhookエンドポイントの処理
   */
  static async handleWebhook(c: Context) {
    try {
      const payload = await c.req.json() as StreamOnlineEvent;

      // イベントタイプの確認
      if (payload.subscription.type !== "stream.online") {
        return c.json({ message: "Event type not handled" }, 200);
      }

      const broadcasterId = payload.event.broadcaster_user_id;
      const broadcasterName = payload.event.broadcaster_user_name;
      const streamTitle = payload.event.title || "";
      const streamUrl = `https://twitch.tv/${payload.event.broadcaster_user_login}`;

      // ブロードキャスターに関連付けられたギルドを取得
      const guildIds = await userRepository.getGuildsByTwitchId(broadcasterId);
      if (!guildIds || guildIds.length === 0) {
        console.log(`No guilds found for broadcaster ${broadcasterId}`);
        return c.json({ message: "No guilds found" }, 200);
      }

      // 各ギルドに通知を送信
      const notificationPromises = guildIds.map(async (guildId) => {
        try {
          // ギルドの通知設定を取得
          const guildSettings = await GuildRepository.getGuildSettings(guildId);
          if (!guildSettings || !guildSettings.channelId) {
            console.log(`No notification settings found for guild ${guildId}`);
            return;
          }

          // ルールに基づいて通知を送信するか判断
          if (guildSettings.rules && guildSettings.rules.length > 0) {
            const matchesRule = guildSettings.rules.some(rule =>
              streamTitle.toLowerCase().includes(rule.toLowerCase())
            );
            if (!matchesRule) {
              console.log(`Stream title does not match rules for guild ${guildId}`);
              return;
            }
          }

          // 通知メッセージを作成
          const message = `🔴 **${broadcasterName}** が配信を開始しました！\n` +
            `**${streamTitle}**\n` +
            `${streamUrl}`;

          // Discord通知を送信
          await DiscordService.sendMessage(guildSettings.channelId, message);
          console.log(`Notification sent to guild ${guildId}`);
        } catch (error) {
          console.error(`Error processing notification for guild ${guildId}:`, error);
        }
      });

      // すべての通知の完了を待つ
      await Promise.all(notificationPromises);

      return c.json({ message: "Notifications processed" }, 200);
    } catch (error) {
      console.error("Error handling webhook:", error);
      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
