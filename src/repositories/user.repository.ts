/// <reference lib="deno.unstable" />
import type { UserRegistration } from "../types/user.ts";

// KVインスタンスの初期化
const kv = await Deno.openKv();

export const userRepository = {
  /**
   * ユーザー登録情報を保存
   */
  async register(data: UserRegistration): Promise<boolean> {
    // Discord User IDをプライマリーキーとして使用
    const result = await kv.atomic()
      .set(["users", data.discordUserId], data)
      .set(["twitch_to_discord", data.twitchUserId], data.discordUserId)
      .commit();

    return result.ok;
  },

  /**
   * Discord User IDによるユーザー情報の取得
   */
  async getByDiscordId(discordUserId: string): Promise<UserRegistration | null> {
    const result = await kv.get<UserRegistration>(["users", discordUserId]);
    return result.value;
  },

  /**
   * Twitch User IDによるユーザー情報の取得
   */
  async getByTwitchId(twitchUserId: string): Promise<UserRegistration | null> {
    const discordId = await kv.get<string>(["twitch_to_discord", twitchUserId]);
    if (!discordId.value) return null;

    return this.getByDiscordId(discordId.value);
  },

  /**
   * サブスクリプション状態の更新
   */
  async updateSubscriptionStatus(discordUserId: string, isSubscribed: boolean): Promise<boolean> {
    const user = await this.getByDiscordId(discordUserId);
    if (!user) return false;

    user.isSubscribed = isSubscribed;
    const result = await kv.set(["users", discordUserId], user);
    return result.ok;
  },

  /**
   * すべてのKVエントリーを取得（デバッグ用）
   */
  async getAllEntries(): Promise<{
    users: UserRegistration[];
    mappings: Record<string, string>;
  }> {
    const users: UserRegistration[] = [];
    const mappings: Record<string, string> = {};

    // ユーザー情報の取得
    const userEntries = kv.list<UserRegistration>({ prefix: ["users"] });
    for await (const entry of userEntries) {
      users.push(entry.value);
    }

    // Twitch-Discordマッピングの取得
    const mappingEntries = kv.list<string>({ prefix: ["twitch_to_discord"] });
    for await (const entry of mappingEntries) {
      const twitchId = entry.key[1] as string;
      mappings[twitchId] = entry.value;
    }

    return { users, mappings };
  },

 /**
  * すべてのKVエントリーを削除（デバッグ用）
  */
 async clearAllEntries(): Promise<boolean> {
   try {
     const { users, mappings } = await this.getAllEntries();

     // Atomicトランザクションを作成
     let atomic = kv.atomic();

     // ユーザー情報の削除
     for (const user of users) {
       atomic = atomic.delete(["users", user.discordUserId]);
     }

     // マッピング情報の削除
     for (const twitchId of Object.keys(mappings)) {
       atomic = atomic.delete(["twitch_to_discord", twitchId]);
     }

     // トランザクションの実行
     const result = await atomic.commit();
     return result.ok;
   } catch (error) {
     console.error("Error in clearAllEntries:", error);
     return false;
   }
 }
};
