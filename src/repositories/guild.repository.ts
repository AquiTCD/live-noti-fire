interface GuildStorage {
  channelId: string;
  rules?: string[];
}

export class GuildRepository {
  private static kv: Deno.Kv;
  private static readonly KEY_PREFIX = 'guildId';

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
        channelId,
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
      return result.value?.channelId ?? null;
    } catch (error) {
      console.error('Error getting notify channel:', error);
      return null;
    }
  }
}
