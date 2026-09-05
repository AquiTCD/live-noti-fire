import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { NotificationRepository } from "../../../src/repositories/notification.repository";

describe("NotificationRepository", () => {
  it("saveNotification then getNotification returns the saved message", async () => {
    const ok = await NotificationRepository.saveNotification(env.KV, "broadcaster1", "guild1", "msg1", "chan1");
    expect(ok).toBe(true);

    const notification = await NotificationRepository.getNotification(env.KV, "broadcaster1", "guild1");
    expect(notification).toEqual({
      broadcaster_id: "broadcaster1",
      guild_id: "guild1",
      message_id: "msg1",
      channel_id: "chan1",
    });
  });

  it("getNotification returns null when nothing is saved", async () => {
    expect(await NotificationRepository.getNotification(env.KV, "unknown", "unknown")).toBeNull();
  });

  it("deleteNotification removes the entry", async () => {
    await NotificationRepository.saveNotification(env.KV, "broadcaster2", "guild2", "msg2", "chan2");
    await NotificationRepository.deleteNotification(env.KV, "broadcaster2", "guild2");
    expect(await NotificationRepository.getNotification(env.KV, "broadcaster2", "guild2")).toBeNull();
  });
});
