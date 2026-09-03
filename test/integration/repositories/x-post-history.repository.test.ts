import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { XPostHistoryRepository } from "../../../src/repositories/x-post-history.repository";

describe("XPostHistoryRepository", () => {
  it("isPosted returns false before setPosted", async () => {
    expect(await XPostHistoryRepository.isPosted(env.KV, "stream-unposted")).toBe(false);
  });

  it("setPosted then isPosted returns true", async () => {
    const ok = await XPostHistoryRepository.setPosted(env.KV, "stream1");
    expect(ok).toBe(true);
    expect(await XPostHistoryRepository.isPosted(env.KV, "stream1")).toBe(true);
  });

  it("setPosted stores the entry with a ~6 hour TTL", async () => {
    await XPostHistoryRepository.setPosted(env.KV, "stream2");
    const list = await env.KV.list({ prefix: "x_posted_history:stream2" });
    expect(list.keys).toHaveLength(1);
    const expiration = list.keys[0].expiration ?? 0;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sixHours = 6 * 60 * 60;
    expect(expiration).toBeGreaterThan(nowSeconds + sixHours - 60);
    expect(expiration).toBeLessThanOrEqual(nowSeconds + sixHours + 60);
  });
});
