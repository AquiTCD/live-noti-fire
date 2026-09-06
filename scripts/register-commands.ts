/**
 * Discordスラッシュコマンドを登録するローカル運用スクリプト
 *
 * 使い方:
 *   pnpm exec tsx scripts/register-commands.ts
 *
 * DISCORD_CLIENT_ID / DISCORD_BOT_TOKEN は .env ファイルまたは
 * シェルの環境変数から読み込む（Cloudflare Workers本体の実行環境とは無関係）。
 */
try {
  process.loadEnvFile(".env");
} catch {
  // .envが存在しない場合はシェルの環境変数をそのまま使う
}

interface Command {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number;
    required: boolean;
  }>;
}

const DISCORD_API_VERSION = "10";
const commands: Command[] = [
  {
    name: "add-streamer",
    description: "Twitchストリーマーの配信通知を登録します",
    options: [
      {
        name: "twitch_username",
        description: "Twitchのユーザー名",
        type: 3, // STRING
        required: true,
      },
      {
        name: "user",
        description: "代理登録する場合、実際の配信者を指定してください（省略時はコマンドを打った本人）",
        type: 6, // USER
        required: false,
      },
    ],
  },
  {
    name: "notify-settings",
    description: "配信通知の設定を行います",
    options: [
      {
        name: "channel",
        description: "通知を送信するチャンネル",
        type: 7, // CHANNEL
        required: true,
      },
      {
        name: "rules",
        description: "通知ルール（カンマ区切りで複数指定可）",
        type: 3, // STRING
        required: false,
      },
    ],
  },
];

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

async function registerCommands() {
  const applicationId = getRequiredEnvVar("DISCORD_CLIENT_ID");
  const botToken = getRequiredEnvVar("DISCORD_BOT_TOKEN");

  const url = `https://discord.com/api/v${DISCORD_API_VERSION}/applications/${applicationId}/commands`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register commands: ${error}`);
    }

    const json = await response.json();
    console.log("Successfully registered commands:");
    console.log(json);

  } catch (error) {
    console.error("Error registering commands:", error);
    process.exit(1);
  }
}

await registerCommands();
