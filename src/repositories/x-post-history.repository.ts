/// <reference lib="deno.unstable" />

/**
 * Xへの投稿履歴を管理するリポジトリ
 * 同一の配信IDに対して短期間に重複して投稿するのを防ぐ
 */
export class XPostHistoryRepository {
  private static kv: Deno.Kv;
  private static readonly KEY_PREFIX = "x_posted_history";
  private static readonly TTL_MS = 6 * 60 * 60 * 1000; // 6時間

  static {
    const initKv = async () => {
      this.kv = await Deno.openKv();
    };
    initKv();
  }

  /**
   * 投稿済みとして記録
   */
  static async setPosted(streamId: string): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, streamId];
      const result = await this.kv.set(key, true, { expireIn: this.TTL_MS });
      return result.ok;
    } catch (error) {
      console.error("Error setting X post history:", error);
      return false;
    }
  }

  /**
   * すでに投稿済みかどうか確認
   */
  static async isPosted(streamId: string): Promise<boolean> {
    try {
      const key = [this.KEY_PREFIX, streamId];
      const result = await this.kv.get<boolean>(key);
      return !!result.value;
    } catch (error) {
      console.error("Error checking X post history:", error);
      return false;
    }
  }
}
