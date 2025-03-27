import { loadEnv } from "../utils/env.ts";

export interface Env {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
}

export const REQUIRED_ENV_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
] as const;

/**
 * 環境変数のバリデーション
 */
export async function validateEnv(): Promise<boolean> {
  await loadEnv();

  const missingEnvVars = REQUIRED_ENV_VARS.filter(
    envVar => !Deno.env.get(envVar)
  );

  if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars);
    return false;
  }

  return true;
}

/**
 * 環境変数の取得（型安全）
 */
export function getEnvVar(key: keyof Env): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}
