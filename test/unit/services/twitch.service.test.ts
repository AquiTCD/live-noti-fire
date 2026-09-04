import { describe, expect, it } from "vitest";
import { TwitchService } from "../../../src/services/twitch.service";

const SECRET = "twitchSubscriptionSecret789";
const MESSAGE =
  "msgid123" +
  "2026-09-04T00:00:00Z" +
  JSON.stringify({ subscription: { id: "sub1" }, event: { broadcaster_user_id: "123" } });

describe("TwitchService.computeHmac (Webhook signature, HMAC-SHA256)", () => {
  it("matches a known-good signature for a fixed message and secret", async () => {
    const signature = await TwitchService.computeHmac(MESSAGE, SECRET);
    expect(signature).toBe("3144a6d969d57ad1c008d9a20c2562c30e1e5d9101f52ed06f428c961d39343e");
  });

  it("produces a different signature when the message is tampered with", async () => {
    const baseline = await TwitchService.computeHmac(MESSAGE, SECRET);
    const tampered = await TwitchService.computeHmac(`${MESSAGE}tampered`, SECRET);
    expect(tampered).not.toBe(baseline);
  });

  it("produces a different signature when the secret is wrong", async () => {
    const baseline = await TwitchService.computeHmac(MESSAGE, SECRET);
    const wrongSecret = await TwitchService.computeHmac(MESSAGE, "wrong-secret");
    expect(wrongSecret).not.toBe(baseline);
  });
});
