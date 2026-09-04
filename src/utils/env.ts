let isEnvLoaded = false;

/**
 * 環境変数を読み込む
 * ローカル環境では.envファイルから、
 * 本番環境ではDeno.envから読み込む
 *
 * Cloudflare Workers環境（Deno未定義）では何もしない。
 * Workersでは環境変数はwrangler secret/varsのバインディング経由で渡されるため、
 * .envファイルの読み込みは不要。
 */
export async function loadEnv() {
  if (isEnvLoaded) return;

  if (typeof Deno === "undefined") {
    isEnvLoaded = true;
    return;
  }

  try {
    // ローカル環境で.envファイルが存在する場合は読み込む
    const text = await Deno.readTextFile("./.env");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");

      if (key && !Deno.env.get(key)) {
        Deno.env.set(key, value);
      }
    }

    isEnvLoaded = true;
  } catch {
    // .envファイルが存在しない場合や読み込みエラーの場合は
    // Deno.envの値をそのまま使用する
    console.log("Using environment variables from Deno.env");
  }
}
