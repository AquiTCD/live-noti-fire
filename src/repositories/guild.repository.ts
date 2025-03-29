interface GuildStorage {
  channel_id: string;
  rules?: string[];
}

export class GuildRepository {
  private static kv: Deno.Kv;
  private static readonly KEY_PREFIX = 'guild_id';

  static {
    const initKv = async () => {
      this.kv = await Deno.openKv();
    };
    initKv();
  }

  /**
   * 通知チャンネルを設定
   */
  static async setNotifyChannel(
    guildId: string,
    channelId: string,
    rules?: string[]
  ): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, guildId];
      const value: GuildStorage = {
        channel_id: channelId,
        ...(rules && rules.length > 0 ? { rules } : {})
      };
      await this.kv.set(key, value);
      return true;
    } catch (error) {
      console.error('Error setting notify channel:', error);
      return false;
    }
  }

  /**
   * 通知チャンネルを取得
   */
  static async getNotifyChannel(guildId: string): Promise<string | null> {
    try {
      const key = [this.KEY_PREFIX, guildId];
      const result = await this.kv.get<GuildStorage>(key);
      return result.value?.channel_id ?? null;
    } catch (error) {
      console.error('Error getting notify channel:', error);
      return null;
    }
  }

  /**
   * ギルドの通知設定を取得
   */
  static async getGuildSettings(guildId: string): Promise<GuildStorage | null> {
    try {
      const key = [this.KEY_PREFIX, guildId];
      const result = await this.kv.get<GuildStorage>(key);
      return result.value ?? null;
    } catch (error) {
      console.error('Error getting guild settings:', error);
      return null;
    }
  }
}
