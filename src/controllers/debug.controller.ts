import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { userRepository } from "../repositories/user.repository.ts";

export class DebugController {
  /**
   * KVストアの内容を表示するエンドポイント
   */
  static async showKvContents(c: Context) {
    try {
      const data = await userRepository.getAllEntries();

      return c.json({
        message: "Current KV store contents",
        data: {
          totalUsers: data.users.length,
          totalMappings: Object.keys(data.mappings).length,
          totalGuildMappings: Object.keys(data.guilds).length,
          totalGuildSettings: Object.keys(data.guildSettings).length,
          users: data.users,
          twitchToDiscordMappings: data.mappings,
          twitchToGuildMappings: data.guilds,
          guildSettings: data.guildSettings,
        }
      }, 200);

    } catch (error: unknown) {
      console.error("Error in showKvContents:", error);

      return c.json({
        error: "Failed to fetch KV contents",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }

  /**
   * KVストアの内容を全て削除するエンドポイント
   */
  static async clearKvContents(c: Context) {
    try {
      const result = await userRepository.clearAllEntries();

      if (!result) {
        return c.json({
          error: "Failed to clear KV contents",
        }, 500);
      }

      return c.json({
        message: "Successfully cleared all KV contents",
      }, 200);

    } catch (error: unknown) {
      console.error("Error in clearKvContents:", error);

      return c.json({
        error: "Failed to clear KV contents",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }

  /**
   * KVストアの指定されたキーのエントリーを削除するエンドポイント
   */
  static async deleteKvEntry(c: Context) {
    try {
      const { key } = await c.req.json();

      if (!Array.isArray(key) || key.length === 0) {
        return c.json({
          error: "Invalid request body: key must be a non-empty array",
          example: {
            key: ["prefix", "value"]
          }
        }, 400);
      }

      const result = await userRepository.deleteByKey(key);

      if (!result) {
        return c.json({
          error: "Failed to delete KV entry",
        }, 500);
      }

      return c.json({
        message: "Successfully deleted KV entry",
        data: {
          key
        }
      }, 200);

    } catch (error: unknown) {
      console.error("Error in deleteKvEntry:", error);

      return c.json({
        error: "Failed to delete KV entry",
        details: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }
}
