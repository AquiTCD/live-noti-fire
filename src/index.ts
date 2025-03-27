/// <reference lib="deno.unstable" />

import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";

const app = new Hono();

// KVインスタンスの初期化
const kv = await Deno.openKv();

app.get("/", (c: Context) => {
  return c.json({
    message: "Hello from Hono!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    uptime: Math.floor(performance.now() / 1000),
  });
});

// サンプルデータを保存するエンドポイント
app.post("/sample", async (c: Context) => {
  const key = crypto.randomUUID();
  const sampleData = {
    id: key,
    content: "サンプルデータ",
    createdAt: new Date().toISOString(),
  };

  try {
    // Deno KVにデータを保存
    const result = await kv.set(["samples", key], sampleData);
    if (!result.ok) {
      throw new Error("データの保存に失敗しました");
    }

    return c.json({
      message: "データを保存しました",
      data: sampleData
    }, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "データの保存に失敗しました",
      details: errorMessage
    }, 500);
  }
});

// 保存したデータを取得するエンドポイント
app.get("/sample/:id", async (c: Context) => {
  const id = c.req.param("id");
  try {
    // Deno KVからデータを取得
    const result = await kv.get(["samples", id]);
    if (!result.value) {
      return c.json({ error: "データが見つかりませんでした" }, 404);
    }
    return c.json(result.value);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "データの取得に失敗しました",
      details: errorMessage
    }, 500);
  }
});

if (import.meta.main) {
  await serve(app.fetch, { port: 8000 });
}

export default app;
