/// <reference lib="deno.unstable" />

// 配信中のストリームを管理するリポジトリ
export class ActiveStreamRepository {
  private static kv: Deno.Kv;
  private static readonly KEY_PREFIX = "active_streams";

  static {
    const initKv = async () => {
      this.kv = await Deno.openKv();
    };
    initKv();
  }

  /**
   * 配信中ストリームをセット
   */
  static async setActive(broadcasterId: string, streamId: string): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId];
      // 配信IDを値として保存
      const result = await this.kv.set(key, streamId);
      return result.ok;
    } catch (error) {
      console.error("Error setting active stream:", error);
      return false;
    }
  }

  /**
   * 配信中ストリームかどうか確認
   */
  static async isActive(broadcasterId: string): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId];
      const result = await this.kv.get<string>(key);
      return !!result.value;
    } catch (error) {
      console.error("Error checking active stream:", error);
      return false;
    }
  }

  /**
   * 配信終了時にストリームを削除
   */
  static async deleteActive(broadcasterId: string): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, broadcasterId];
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error("Error deleting active stream:", error);
      return false;
    }
  }
}
