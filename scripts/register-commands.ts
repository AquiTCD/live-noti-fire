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
    name: "live-register",
    description: "Twitchの配信通知を登録します",
    options: [
      {
        name: "twitch_id",
        description: "TwitchのユーザーID",
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

async function registerCommands() {
  const applicationId = getEnvVar("DISCORD_CLIENT_ID");
  const botToken = getEnvVar("DISCORD_CLIENT_SECRET");

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
