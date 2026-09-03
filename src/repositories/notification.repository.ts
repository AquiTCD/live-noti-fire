interface NotificationMessage {
  broadcaster_id: string;
  guild_id: string;
  message_id: string;
  channel_id: string;
}

export class NotificationRepository {
  private static readonly KEY_PREFIX = 'notification';

  /**
   * 配信通知メッセージを保存
   */
  static async saveNotification(
    kv: KVNamespace,
    broadcasterId: string,
    guildId: string,
    messageId: string,
    channelId: string
  ): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}:${guildId}`;
      const value: NotificationMessage = {
        broadcaster_id: broadcasterId,
        guild_id: guildId,
        message_id: messageId,
        channel_id: channelId
      };
      await kv.put(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error saving notification:', error);
      return false;
    }
  }

  /**
   * 配信通知メッセージを取得
   */
  static async getNotification(
    kv: KVNamespace,
    broadcasterId: string,
    guildId: string
  ): Promise<NotificationMessage | null> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}:${guildId}`;
      return await kv.get<NotificationMessage>(key, "json");
    } catch (error) {
      console.error('Error getting notification:', error);
      return null;
    }
  }

  /**
   * 配信通知メッセージを削除
   */
  static async deleteNotification(
    kv: KVNamespace,
    broadcasterId: string,
    guildId: string
  ): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}:${guildId}`;
      await kv.delete(key);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }
}
