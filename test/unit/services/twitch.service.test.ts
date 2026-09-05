import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("TwitchService.subscribeToStreamEvents", () => {
  const env = {
    TWITCH_CLIENT_ID: "client-id",
    TWITCH_CLIENT_SECRET: "client-secret",
    TWITCH_SUBSCRIPTION_SECRET: "sub-secret",
    TWITCH_CALLBACK_URL: "https://my-worker.example.workers.dev/twitch/webhooks",
  } as unknown as Env;

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ data: { id: "sub1" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the EventSub callback from env.TWITCH_CALLBACK_URL, not a hardcoded URL", async () => {
    await TwitchService.subscribeToStreamEvents(env, "broadcaster1");

    const eventsubCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("eventsub/subscriptions"));
    expect(eventsubCalls.length).toBeGreaterThan(0);

    for (const [, options] of eventsubCalls) {
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.transport.callback).toBe(env.TWITCH_CALLBACK_URL);
    }
  });
});
