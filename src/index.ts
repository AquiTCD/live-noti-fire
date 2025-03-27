import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import { rootHandler, healthHandler } from "./routes/root.ts";
import {
  createSampleHandler,
  getSampleHandler,
  listSamplesHandler
} from "./routes/sample.ts";

const app = new Hono();

// ルートハンドラー
app.get("/", rootHandler);
app.get("/health", healthHandler);

// サンプルデータ関連のハンドラー
app.post("/sample", createSampleHandler);
app.get("/sample/:id", getSampleHandler);
app.get("/samples", listSamplesHandler);

if (import.meta.main) {
  await serve(app.fetch, { port: 8000 });
}

export default app;
