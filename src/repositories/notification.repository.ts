interface NotificationMessage {
  broadcaster_id: string;
  guild_id: string;
  message_id: string;
  channel_id: string;
}

export class NotificationRepository {
  private static kv: Deno.Kv;
  private static readonly KEY_PREFIX = 'notification';

  static {
    const initKv = async () => {
      this.kv = await Deno.openKv();
    };
    initKv();
  }

  /**
   * 配信通知メッセージを保存
   */
  static async saveNotification(
    broadcasterId: string,
    guildId: string,
    messageId: string,
    channelId: string
  ): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId, guildId];
      const value: NotificationMessage = {
        broadcaster_id: broadcasterId,
        guild_id: guildId,
        message_id: messageId,
        channel_id: channelId
      };
      const result = await this.kv.set(key, value);
      return result.ok;
    } catch (error) {
      console.error('Error saving notification:', error);
      return false;
    }
  }

  /**
   * 配信通知メッセージを取得
   */
  static async getNotification(
    broadcasterId: string,
    guildId: string
  ): Promise<NotificationMessage | null> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId, guildId];
      const result = await this.kv.get<NotificationMessage>(key);
      return result.value;
    } catch (error) {
      console.error('Error getting notification:', error);
      return null;
    }
  }

  /**
   * 配信通知メッセージを削除
   */
  static async deleteNotification(
    broadcasterId: string,
    guildId: string
  ): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId, guildId];
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }
}
