/// <reference lib="deno.unstable" />
import type { UserRegistration } from "../types/user.ts";

// KVインスタンスの初期化
const kv = await Deno.openKv();

export const userRepository = {
  /**
   * ユーザー登録情報を保存
   */
  async register(twitchUserId: string, guildId: string): Promise<boolean> {
    try {
      // 既存のギルドリストを取得
      const existingEntry = await kv.get<string[]>(["broadcasterId", twitchUserId]);
      const existingGuilds = existingEntry.value || [];

      // 既に登録されているか確認
      if (existingGuilds.includes(guildId)) {
        return true;
      }

      // 新しいギルドIDを追加
      const updatedGuilds = [...existingGuilds, guildId];
      const result = await kv.set(["broadcasterId", twitchUserId], updatedGuilds);

      return result.ok;
    } catch (error) {
      console.error("Error in register:", error);
      return false;
    }
  },

  /**
   * Twitchユーザーに関連付けられたギルドIDリストを取得
   */
  async getGuildsByTwitchId(twitchUserId: string): Promise<string[]> {
    const result = await kv.get<string[]>(["broadcasterId", twitchUserId]);
    return result.value || [];
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
    guilds: Record<string, string[]>;
    guildSettings: Record<string, unknown>;
  }> {
    const users: UserRegistration[] = [];
    const mappings: Record<string, string> = {};
    const guilds: Record<string, string[]> = {};
    const guildSettings: Record<string, unknown> = {};

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

    // Twitchユーザーとギルドのマッピングを取得
    const guildEntries = kv.list<string[]>({ prefix: ["broadcasterId"] });
    for await (const entry of guildEntries) {
      const twitchId = entry.key[1] as string;
      guilds[twitchId] = entry.value;
    }

    // ギルド設定の取得
    const guildSettingsEntries = kv.list({ prefix: ["guildId"] });
    for await (const entry of guildSettingsEntries) {
      const guildId = entry.key[1] as string;
      guildSettings[guildId] = entry.value;
    }

    return { users, mappings, guilds, guildSettings };
  },

 /**
  * すべてのKVエントリーを削除（デバッグ用）
  */
 async clearAllEntries(): Promise<boolean> {
   try {
     const { users, mappings, guilds, guildSettings } = await this.getAllEntries();

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

     // Twitchユーザーとギルドのマッピング情報の削除
     for (const twitchId of Object.keys(guilds)) {
       atomic = atomic.delete(["broadcasterId", twitchId]);
     }

     // ギルド設定の削除
     for (const guildId of Object.keys(guildSettings)) {
       atomic = atomic.delete(["guildId", guildId]);
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
