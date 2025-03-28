import { getEnvVar } from "../src/types/env.ts";

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

async function registerCommands() {
  const applicationId = getEnvVar("DISCORD_CLIENT_ID");
  const botToken = getEnvVar("DISCORD_BOT_TOKEN");

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
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await registerCommands();
}
