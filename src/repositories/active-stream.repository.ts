// 配信中のストリームを管理するリポジトリ
export class ActiveStreamRepository {
  private static readonly KEY_PREFIX = "active_streams";

  /**
   * 配信中ストリームをセット
   */
  static async setActive(kv: KVNamespace, broadcasterId: string, streamId: string): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}`;
      // 配信IDを値として保存
      await kv.put(key, streamId);
      return true;
    } catch (error) {
      console.error("Error setting active stream:", error);
      return false;
    }
  }

  /**
   * 配信中ストリームかどうか確認
   */
  static async isActive(kv: KVNamespace, broadcasterId: string): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}`;
      const value = await kv.get(key);
      return !!value;
    } catch (error) {
      console.error("Error checking active stream:", error);
      return false;
    }
  }

  /**
   * 配信終了時にストリームを削除
   */
  static async deleteActive(kv: KVNamespace, broadcasterId: string): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${broadcasterId}`;
      await kv.delete(key);
      return true;
    } catch (error) {
      console.error("Error deleting active stream:", error);
      return false;
    }
  }
}
