import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { GuildRepository } from "../../../src/repositories/guild.repository";

describe("GuildRepository", () => {
  it("setNotifyChannel then getNotifyChannel returns the channel id", async () => {
    const ok = await GuildRepository.setNotifyChannel(env.KV, "guild1", "chan1");
    expect(ok).toBe(true);
    expect(await GuildRepository.getNotifyChannel(env.KV, "guild1")).toBe("chan1");
  });

  it("getNotifyChannel returns null for unknown guild", async () => {
    expect(await GuildRepository.getNotifyChannel(env.KV, "unknown")).toBeNull();
  });

  it("setNotifyChannel stores rules when provided", async () => {
    await GuildRepository.setNotifyChannel(env.KV, "guild2", "chan2", ["rule-a", "rule-b"]);
    const settings = await GuildRepository.getGuildSettings(env.KV, "guild2");
    expect(settings).toEqual({ channel_id: "chan2", rules: ["rule-a", "rule-b"] });
  });

  it("setNotifyChannel omits rules key when rules is empty", async () => {
    await GuildRepository.setNotifyChannel(env.KV, "guild3", "chan3", []);
    const settings = await GuildRepository.getGuildSettings(env.KV, "guild3");
    expect(settings).toEqual({ channel_id: "chan3" });
  });
});
