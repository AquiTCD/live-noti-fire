interface GuildStorage {
  channel_id: string;
  rules?: string[];
}

export class GuildRepository {
  private static readonly KEY_PREFIX = 'guild_id';

  /**
   * 通知チャンネルを設定
   */
  static async setNotifyChannel(
    kv: KVNamespace,
    guildId: string,
    channelId: string,
    rules?: string[]
  ): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${guildId}`;
      const value: GuildStorage = {
        channel_id: channelId,
        ...(rules && rules.length > 0 ? { rules } : {})
      };
      await kv.put(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting notify channel:', error);
      return false;
    }
  }

  /**
   * 通知チャンネルを取得
   */
  static async getNotifyChannel(kv: KVNamespace, guildId: string): Promise<string | null> {
    try {
      const key = `${this.KEY_PREFIX}:${guildId}`;
      const result = await kv.get<GuildStorage>(key, "json");
      return result?.channel_id ?? null;
    } catch (error) {
      console.error('Error getting notify channel:', error);
      return null;
    }
  }

  /**
   * ギルドの通知設定を取得
   */
  static async getGuildSettings(kv: KVNamespace, guildId: string): Promise<GuildStorage | null> {
    try {
      const key = `${this.KEY_PREFIX}:${guildId}`;
      return await kv.get<GuildStorage>(key, "json");
    } catch (error) {
      console.error('Error getting guild settings:', error);
      return null;
    }
  }
}
