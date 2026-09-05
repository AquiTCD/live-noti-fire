import type { UserRegistration } from "../types/user";

const USERS_PREFIX = "users";
const TWITCH_TO_DISCORD_PREFIX = "twitch_to_discord";
const BROADCASTER_ID_PREFIX = "broadcaster_id";
const GUILD_ID_PREFIX = "guild_id";

async function listAll(kv: KVNamespace, prefix: string): Promise<{ name: string; value: string }[]> {
  const entries: { name: string; value: string }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await kv.list({ prefix, cursor });
    for (const key of page.keys) {
      const value = await kv.get(key.name);
      if (value !== null) entries.push({ name: key.name, value });
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return entries;
}

export const userRepository = {
  /**
   * ユーザー登録情報を保存
   */
  async register(kv: KVNamespace, twitchUserId: string, discordUserId: string, guildId: string): Promise<boolean> {
    try {
      // ユーザー情報の登録
      const userRegistration: UserRegistration = {
        discordUserId,
        twitchUserId,
        registeredAt: new Date().toISOString(),
        isSubscribed: false,
      };
      await kv.put(`${USERS_PREFIX}:${discordUserId}`, JSON.stringify(userRegistration));

      // Twitch-Discord マッピングの登録
      await kv.put(`${TWITCH_TO_DISCORD_PREFIX}:${twitchUserId}`, discordUserId);

      // 既存のギルドリストを取得
      const existingGuilds = (await kv.get<string[]>(`${BROADCASTER_ID_PREFIX}:${twitchUserId}`, "json")) ?? [];

      // 既に登録されているか確認
      if (existingGuilds.includes(guildId)) {
        return true;
      }

      // 新しいギルドIDを追加
      const updatedGuilds = [...existingGuilds, guildId];
      await kv.put(`${BROADCASTER_ID_PREFIX}:${twitchUserId}`, JSON.stringify(updatedGuilds));

      return true;
    } catch (error) {
      console.error("Error in register:", error);
      return false;
    }
  },

  /**
   * Twitchユーザーに関連付けられたギルドIDリストを取得
   */
  async getGuildsByTwitchId(kv: KVNamespace, twitchUserId: string): Promise<string[]> {
    const value = await kv.get<string[]>(`${BROADCASTER_ID_PREFIX}:${twitchUserId}`, "json");
    return value ?? [];
  },

  /**
   * Discord User IDによるユーザー情報の取得
   */
  async getByDiscordId(kv: KVNamespace, discordUserId: string): Promise<UserRegistration | null> {
    return await kv.get<UserRegistration>(`${USERS_PREFIX}:${discordUserId}`, "json");
  },

  /**
   * Twitch User IDによるユーザー情報の取得
   */
  async getByTwitchId(kv: KVNamespace, twitchUserId: string): Promise<UserRegistration | null> {
    const discordId = await kv.get(`${TWITCH_TO_DISCORD_PREFIX}:${twitchUserId}`);
    if (!discordId) return null;

    return this.getByDiscordId(kv, discordId);
  },

  /**
   * サブスクリプション状態の更新
   */
  async updateSubscriptionStatus(kv: KVNamespace, discordUserId: string, isSubscribed: boolean): Promise<boolean> {
    const user = await this.getByDiscordId(kv, discordUserId);
    if (!user) return false;

    user.isSubscribed = isSubscribed;
    await kv.put(`${USERS_PREFIX}:${discordUserId}`, JSON.stringify(user));
    return true;
  },

  /**
   * すべてのKVエントリーを取得（デバッグ用）
   */
  async getAllEntries(kv: KVNamespace): Promise<{
    users: UserRegistration[];
    mappings: Record<string, string>;
    guilds: Record<string, string[]>;
    guildSettings: Record<string, unknown>;
  }> {
    const users: UserRegistration[] = [];
    const mappings: Record<string, string> = {};
    const guilds: Record<string, string[]> = {};
    const guildSettings: Record<string, unknown> = {};

    for (const entry of await listAll(kv, `${USERS_PREFIX}:`)) {
      users.push(JSON.parse(entry.value) as UserRegistration);
    }

    for (const entry of await listAll(kv, `${TWITCH_TO_DISCORD_PREFIX}:`)) {
      const twitchId = entry.name.slice(`${TWITCH_TO_DISCORD_PREFIX}:`.length);
      mappings[twitchId] = entry.value;
    }

    for (const entry of await listAll(kv, `${BROADCASTER_ID_PREFIX}:`)) {
      const twitchId = entry.name.slice(`${BROADCASTER_ID_PREFIX}:`.length);
      guilds[twitchId] = JSON.parse(entry.value) as string[];
    }

    for (const entry of await listAll(kv, `${GUILD_ID_PREFIX}:`)) {
      const guildId = entry.name.slice(`${GUILD_ID_PREFIX}:`.length);
      guildSettings[guildId] = JSON.parse(entry.value);
    }

    return { users, mappings, guilds, guildSettings };
  },

  /**
   * すべてのKVエントリーを削除（デバッグ用）
   *
   * Cloudflare KVには複数キーのatomicトランザクションが存在しないため、
   * 逐次deleteで代替する（デバッグ専用機能のため許容）。
   */
  async clearAllEntries(kv: KVNamespace): Promise<boolean> {
    try {
      const { users, mappings, guilds, guildSettings } = await this.getAllEntries(kv);

      await Promise.all([
        ...users.map((user) => kv.delete(`${USERS_PREFIX}:${user.discordUserId}`)),
        ...Object.keys(mappings).map((twitchId) => kv.delete(`${TWITCH_TO_DISCORD_PREFIX}:${twitchId}`)),
        ...Object.keys(guilds).map((twitchId) => kv.delete(`${BROADCASTER_ID_PREFIX}:${twitchId}`)),
        ...Object.keys(guildSettings).map((guildId) => kv.delete(`${GUILD_ID_PREFIX}:${guildId}`)),
      ]);

      return true;
    } catch (error) {
      console.error("Error in clearAllEntries:", error);
      return false;
    }
  },

  /**
   * 指定されたキーのエントリーを削除（デバッグ用）
   */
  async deleteByKey(kv: KVNamespace, key: string): Promise<boolean> {
    try {
      if (!key) {
        throw new Error("Invalid key format: key must be a non-empty string");
      }
      await kv.delete(key);
      return true;
    } catch (error) {
      console.error("Error in deleteByKey:", error);
      return false;
    }
  }
};
