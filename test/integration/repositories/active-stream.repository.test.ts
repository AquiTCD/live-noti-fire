import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { ActiveStreamRepository } from "../../../src/repositories/active-stream.repository";

describe("ActiveStreamRepository", () => {
  it("setActive then isActive returns true", async () => {
    const ok = await ActiveStreamRepository.setActive(env.KV, "broadcaster1", "stream1");
    expect(ok).toBe(true);
    expect(await ActiveStreamRepository.isActive(env.KV, "broadcaster1")).toBe(true);
  });

  it("isActive returns false for unknown broadcaster", async () => {
    expect(await ActiveStreamRepository.isActive(env.KV, "unknown")).toBe(false);
  });

  it("deleteActive removes the entry", async () => {
    await ActiveStreamRepository.setActive(env.KV, "broadcaster2", "stream2");
    await ActiveStreamRepository.deleteActive(env.KV, "broadcaster2");
    expect(await ActiveStreamRepository.isActive(env.KV, "broadcaster2")).toBe(false);
  });
});
