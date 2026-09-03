import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("KV binding smoke test", () => {
  it("can put and get a value", async () => {
    await env.KV.put("smoke:key", "hello");
    const value = await env.KV.get("smoke:key");
    expect(value).toBe("hello");
  });
});
