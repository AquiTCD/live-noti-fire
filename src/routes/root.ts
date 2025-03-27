import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";

export const rootHandler = (c: Context) => {
  return c.json({
    message: "Hello from Hono!",
    timestamp: new Date().toISOString(),
  });
};

export const healthHandler = (c: Context) => {
  return c.json({
    status: "ok",
    uptime: Math.floor(performance.now() / 1000),
  });
};
