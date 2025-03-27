import { load } from "std/dotenv";

let isEnvLoaded = false;

/**
 * 環境変数を読み込む
 * ローカル環境では.envファイルから、
 * 本番環境ではDeno.envから読み込む
 */
export async function loadEnv() {
  if (isEnvLoaded) return;

  try {
    // ローカル環境で.envファイルが存在する場合は読み込む
    const env = await load({
      envPath: "./.env",
      examplePath: "./.env.example",
      export: true,
    });

    // .envの内容をDeno.envに反映
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && !Deno.env.get(key)) {
        Deno.env.set(key, value);
      }
    }

    isEnvLoaded = true;
  } catch (error) {
    // .envファイルが存在しない場合や読み込みエラーの場合は
    // Deno.envの値をそのまま使用する
    console.log("Using environment variables from Deno.env");
  }
}
