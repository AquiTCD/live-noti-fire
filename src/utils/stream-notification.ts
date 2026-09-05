import type { DiscordEmbed } from "../services/discord.service";

interface StreamInfo {
  user_name: string;
  title: string;
  game_name: string;
  thumbnail_url: string;
  tags: string[];
}

/**
 * 配信タイトルがギルドの通知ルールに合致するか判定する。
 * ルール未設定（undefined または空配列）の場合は常に通知対象とする。
 */
export function matchesNotificationRules(title: string, rules?: string[]): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }

  const lowerTitle = title.toLowerCase();
  return rules.some((rule) => lowerTitle.includes(rule.toLowerCase()));
}

/**
 * Twitchのストリーム情報からDiscord通知用のembedを構築する。
 */
export function buildStreamEmbed(streamInfo: StreamInfo, streamUrl: string): DiscordEmbed {
  return {
    author: {
      name: streamInfo.user_name
    },
    title: streamInfo.title,
    url: streamUrl,
    color: 0x6441A4, // Twitchのブランドカラー
    fields: [
      {
        name: "GAME",
        value: streamInfo.game_name || "未設定",
        inline: true
      },
      {
        name: "TAG",
        value: streamInfo.tags?.length > 0
          ? streamInfo.tags.join(", ")
          : "-",
        inline: true
      }
    ],
    image: {
      url: streamInfo.thumbnail_url
    }
  };
}
