import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { serve } from "https://deno.land/std@0.218.2/http/server.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "Hello from Hono!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    uptime: Math.floor(performance.now() / 1000),
  });
});

if (import.meta.main) {
  await serve(app.fetch, { port: 8000 });
}

export default app;
