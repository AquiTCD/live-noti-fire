/**
 * Xへの投稿履歴を管理するリポジトリ
 * 同一の配信IDに対して短期間に重複して投稿するのを防ぐ
 */
export class XPostHistoryRepository {
  private static readonly KEY_PREFIX = "x_posted_history";
  private static readonly TTL_SECONDS = 6 * 60 * 60; // 6時間

  /**
   * 投稿済みとして記録
   */
  static async setPosted(kv: KVNamespace, streamId: string): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${streamId}`;
      await kv.put(key, "true", { expirationTtl: this.TTL_SECONDS });
      return true;
    } catch (error) {
      console.error("Error setting X post history:", error);
      return false;
    }
  }

  /**
   * すでに投稿済みかどうか確認
   */
  static async isPosted(kv: KVNamespace, streamId: string): Promise<boolean> {
    try {
      const key = `${this.KEY_PREFIX}:${streamId}`;
      const value = await kv.get(key);
      return !!value;
    } catch (error) {
      console.error("Error checking X post history:", error);
      return false;
    }
  }
}
