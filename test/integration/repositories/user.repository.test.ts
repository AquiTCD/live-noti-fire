import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { userRepository } from "../../../src/repositories/user.repository";

async function clearKv() {
  const list = await env.KV.list();
  await Promise.all(list.keys.map((k) => env.KV.delete(k.name)));
}

describe("userRepository", () => {
  beforeEach(async () => {
    await clearKv();
  });

  it("register then getByDiscordId returns the registered user", async () => {
    const ok = await userRepository.register(env.KV, "twitch1", "discord1", "guild1");
    expect(ok).toBe(true);

    const user = await userRepository.getByDiscordId(env.KV, "discord1");
    expect(user).toMatchObject({
      discordUserId: "discord1",
      twitchUserId: "twitch1",
      isSubscribed: false,
    });
  });

  it("register then getByTwitchId returns the same user", async () => {
    await userRepository.register(env.KV, "twitch2", "discord2", "guild1");
    const user = await userRepository.getByTwitchId(env.KV, "twitch2");
    expect(user?.discordUserId).toBe("discord2");
  });

  it("register adds the guild id to getGuildsByTwitchId", async () => {
    await userRepository.register(env.KV, "twitch3", "discord3", "guildA");
    await userRepository.register(env.KV, "twitch3", "discord3", "guildB");
    const guilds = await userRepository.getGuildsByTwitchId(env.KV, "twitch3");
    expect(guilds.sort()).toEqual(["guildA", "guildB"]);
  });

  it("register does not duplicate an already-registered guild id", async () => {
    await userRepository.register(env.KV, "twitch4", "discord4", "guildA");
    await userRepository.register(env.KV, "twitch4", "discord4", "guildA");
    const guilds = await userRepository.getGuildsByTwitchId(env.KV, "twitch4");
    expect(guilds).toEqual(["guildA"]);
  });

  it("getGuildsByTwitchId returns an empty array for an unknown user", async () => {
    expect(await userRepository.getGuildsByTwitchId(env.KV, "unknown")).toEqual([]);
  });

  it("getByDiscordId returns null for an unknown user", async () => {
    expect(await userRepository.getByDiscordId(env.KV, "unknown")).toBeNull();
  });

  it("getByTwitchId returns null for an unknown user", async () => {
    expect(await userRepository.getByTwitchId(env.KV, "unknown")).toBeNull();
  });

  it("updateSubscriptionStatus flips isSubscribed on the stored user", async () => {
    await userRepository.register(env.KV, "twitch5", "discord5", "guild1");
    const ok = await userRepository.updateSubscriptionStatus(env.KV, "discord5", true);
    expect(ok).toBe(true);

    const user = await userRepository.getByDiscordId(env.KV, "discord5");
    expect(user?.isSubscribed).toBe(true);
  });

  it("updateSubscriptionStatus returns false for an unknown user", async () => {
    expect(await userRepository.updateSubscriptionStatus(env.KV, "unknown", true)).toBe(false);
  });

  it("getAllEntries aggregates users, mappings, guilds and guild settings", async () => {
    await userRepository.register(env.KV, "twitch6", "discord6", "guild1");
    await env.KV.put("guild_id:guild1", JSON.stringify({ channel_id: "chan1" }));

    const all = await userRepository.getAllEntries(env.KV);
    expect(all.users).toHaveLength(1);
    expect(all.users[0].discordUserId).toBe("discord6");
    expect(all.mappings["twitch6"]).toBe("discord6");
    expect(all.guilds["twitch6"]).toEqual(["guild1"]);
    expect(all.guildSettings["guild1"]).toEqual({ channel_id: "chan1" });
  });

  it("clearAllEntries removes every entry produced by register", async () => {
    await userRepository.register(env.KV, "twitch7", "discord7", "guild1");
    await env.KV.put("guild_id:guild1", JSON.stringify({ channel_id: "chan1" }));

    const ok = await userRepository.clearAllEntries(env.KV);
    expect(ok).toBe(true);

    const all = await userRepository.getAllEntries(env.KV);
    expect(all.users).toEqual([]);
    expect(all.mappings).toEqual({});
    expect(all.guilds).toEqual({});
    expect(all.guildSettings).toEqual({});
  });

  it("deleteByKey removes a single entry by its full string key", async () => {
    await userRepository.register(env.KV, "twitch8", "discord8", "guild1");
    const ok = await userRepository.deleteByKey(env.KV, "users:discord8");
    expect(ok).toBe(true);
    expect(await userRepository.getByDiscordId(env.KV, "discord8")).toBeNull();
  });

  it("deleteByKey rejects an empty key", async () => {
    expect(await userRepository.deleteByKey(env.KV, "")).toBe(false);
  });
});
