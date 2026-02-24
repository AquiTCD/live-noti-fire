import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { GuildRepository } from "../repositories/guild.repository.ts";
import { DiscordService, DiscordEmbed } from "../services/discord.service.ts";
import { NotificationRepository } from "../repositories/notification.repository.ts";
import { TwitchService } from "../services/twitch.service.ts";
import { ActiveStreamRepository } from "../repositories/active-stream.repository.ts";
import { XService } from "../services/x.service.ts";
import { XPostHistoryRepository } from "../repositories/x-post-history.repository.ts";
import { getEnvVar } from "../types/env.ts";

interface StreamEvent {
  subscription: {
    id: string;
    type: string;
    version: string;
    status: string;
    condition: {
      broadcaster_user_id: string;
    };
    transport: {
      method: string;
      callback: string;
    };
    created_at: string;
  };
  event: {
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type?: string;
    started_at?: string;
  };
}

export class TwitchController {
  /**
   * Webhookエンドポイントの処理
   */
  static async handleWebhook(c: Context) {
    try {
      // Twitchからのリクエストヘッダーを取得
      const messageId = c.req.header("Twitch-Eventsub-Message-Id");
      const timestamp = c.req.header("Twitch-Eventsub-Message-Timestamp");
      const signature = c.req.header("Twitch-Eventsub-Message-Signature");
      const messageType = c.req.header("Twitch-Eventsub-Message-Type");

      if (!messageId || !timestamp || !signature || !messageType) {
        console.error("Missing required Twitch headers");
        return c.json({ error: "Missing required headers" }, 400);
      }

      // リクエストボディを取得
      const rawBody = await c.req.text();
      const payload = JSON.parse(rawBody);

      console.log("Received Twitch webhook:", messageType);

      // Verificationリクエストの処理
      if (messageType === "webhook_callback_verification") {
        console.log("Received verification request");
        return new Response(payload.challenge, {
          status: 200,
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }

      // 通知とRevocationの場合の処理
      if (messageType === "notification" || messageType === "revocation") {
        const streamPayload = payload as StreamEvent;
        console.log("Received webhook payload:", {
          type: messageType,
          subscriptionType: streamPayload.subscription.type,
          subscriptionId: streamPayload.subscription.id,
          event: streamPayload.event
        });

        // リクエストの署名を検証
        const isValid = await TwitchService.verifyWebhookRequest(
          messageId,
          timestamp,
          signature,
          rawBody
        );

        if (!isValid) {
          console.error("Invalid webhook signature");
          return c.json({ error: "Invalid signature" }, 401);
        }

        // Revocationの場合は処理を終了
        if (messageType === "revocation") {
          console.log(`Subscription revoked: ${streamPayload.subscription.id}`);
          return c.json({ message: "Revocation processed" }, 200);
        }

        // 以降は通知処理
        const broadcasterId = streamPayload.subscription.condition.broadcaster_user_id;
        const broadcasterName = streamPayload.event.broadcaster_user_name;
        const streamUrl = `https://twitch.tv/${streamPayload.event.broadcaster_user_login}`;

        // ブロードキャスターに関連付けられたギルドを取得
        const guildIds = await userRepository.getGuildsByTwitchId(broadcasterId);
        if (!guildIds || guildIds.length === 0) {
          console.log(`No guilds found for broadcaster ${broadcasterId}`);
          return c.json({ message: "No guilds found" }, 200);
        }

        if (streamPayload.subscription.type === "stream.online") {
          // ストリーム情報を取得
          const streamInfo = await TwitchService.getStreamInfo(broadcasterId);
          if (!streamInfo) {
            console.log(`No stream info found for broadcaster ${broadcasterId}`);
            return c.json({ message: "No stream info found" }, 200);
          }

          // すでに配信中なら通知しない
          const isActive = await ActiveStreamRepository.isActive(broadcasterId, streamInfo.id);
          if (isActive) {
            console.log(`Already notified for stream ${streamInfo.id}`);
            return c.json({ message: "Already notified" }, 200);
          }
          // 配信中として記録
          await ActiveStreamRepository.setActive(broadcasterId, streamInfo.id);

          // Xへのポスト（ターゲットユーザーのみ）
          if (broadcasterId === getEnvVar("X_TARGET_TWITCH_ID")) {
            const isXPosted = await XPostHistoryRepository.isPosted(streamInfo.id);
            if (!isXPosted) {
              // 非同期で実行（Discord通知を優先）
              (async () => {
                const success = await XService.postStreamTweet(streamInfo.title, streamUrl);
                if (success) {
                  await XPostHistoryRepository.setPosted(streamInfo.id);
                }
              })();
            } else {
              console.log(`Already posted to X for stream ${streamInfo.id}`);
            }
          }

          // 各ギルドに通知を送信
          const notificationPromises = guildIds.map(async (guildId) => {
            try {
              // ギルドの通知設定を取得
              const guildSettings = await GuildRepository.getGuildSettings(guildId);
              if (!guildSettings || !guildSettings.channel_id) {
                console.log(`No notification settings found for guild ${guildId}`);
                return;
              }

              // ルールに基づいて通知を送信するか判断
              if (guildSettings.rules && guildSettings.rules.length > 0) {
                const matchesRule = guildSettings.rules.some(rule =>
                  streamInfo.title.toLowerCase().includes(rule.toLowerCase())
                );
                if (!matchesRule) {
                  console.log(`Stream title does not match rules for guild ${guildId}`);
                  return;
                }
              }

              // embedメッセージを作成
              const embed: DiscordEmbed = {
                author: {
                  name: streamInfo.user_name
                },
                title: streamInfo.title,
                url: streamUrl,
                color: 0x6441A4, // Twitchのブランドカラー
                fields: [
                  {
                    name: "GAME",
                    value: streamInfo.game_name || "未設定",
                    inline: true
                  },
                  {
                    name: "TAG",
                    value: streamInfo.tags?.length > 0
                      ? streamInfo.tags.join(", ")
                      : "-",
                    inline: true
                  }
                ],
                image: {
                  url: streamInfo.thumbnail_url
                }
              };

              // TwitchユーザーIDに紐づくDiscordユーザー情報を取得
              const user = await userRepository.getByTwitchId(broadcasterId);
              if (!user) {
                console.log(`No Discord user found for Twitch user ${broadcasterId}`);
                return;
              }

              // Discord通知を送信（メンション付き）
              const messageId = await DiscordService.sendEmbedMessage(
                guildSettings.channel_id,
                `🔴 <@${user.discordUserId}> が配信を開始しました！`,
                embed
              );

              // 通知メッセージの情報を保存
              await NotificationRepository.saveNotification(
                broadcasterId,
                guildId,
                messageId,
                guildSettings.channel_id
              );

              console.log(`Notification sent to guild ${guildId}`);
            } catch (error) {
              console.error(`Error processing notification for guild ${guildId}:`, error);
            }
          });

          // すべての通知の完了を待つ
          await Promise.all(notificationPromises);
        } else if (streamPayload.subscription.type === "stream.offline") {
          // ストリーム情報を取得
          const streamInfo = await TwitchService.getStreamInfo(broadcasterId);
          if (streamInfo) {
            // 配信中ストリームを削除
            await ActiveStreamRepository.deleteActive(broadcasterId, streamInfo.id);
          }

          // 各ギルドの通知メッセージにリアクションを追加
          const reactionPromises = guildIds.map(async (guildId) => {
            try {
              // 保存された通知メッセージの情報を取得
              const notification = await NotificationRepository.getNotification(broadcasterId, guildId);
              if (!notification) {
                console.log(`No notification found for broadcaster ${broadcasterId} in guild ${guildId}`);
                return;
              }

              // メッセージに配信終了のリアクションを追加
              await DiscordService.addReaction(
                notification.channel_id,
                notification.message_id,
                "🚫"
              );

              // 通知メッセージの情報を削除
              await NotificationRepository.deleteNotification(broadcasterId, guildId);

              console.log(`Added offline reaction to notification in guild ${guildId}`);
            } catch (error) {
              console.error(`Error processing offline event for guild ${guildId}:`, error);
            }
          });

          // すべてのリアクション追加の完了を待つ
          await Promise.all(reactionPromises);
        }
      }

      return c.json({ message: "Event processed" }, 200);
    } catch (error) {
      console.error("Error handling webhook:", error);
      return c.json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
