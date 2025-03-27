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
  }
};
