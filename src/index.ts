import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";

// Cloudflare Workers の型定義
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

type Bindings = {
  SAMPLE_STORE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

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
app.post("/sample", async (c: Context<{ Bindings: Bindings }>) => {
  const key = crypto.randomUUID();
  const sampleData = {
    id: key,
    content: "サンプルデータ",
    createdAt: new Date().toISOString(),
  };

  try {
    await c.env.SAMPLE_STORE.put(key, JSON.stringify(sampleData));
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
app.get("/sample/:id", async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param("id");
  try {
    const data = await c.env.SAMPLE_STORE.get(id);
    if (!data) {
      return c.json({ error: "データが見つかりませんでした" }, 404);
    }
    return c.json(JSON.parse(data));
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
