import { describe, expect, it } from "vitest";
import { XService } from "../../../src/services/x.service";

const FIXED_PARAMS = {
  oauth_consumer_key: "consumerKey123",
  oauth_nonce: "nonce123",
  oauth_signature_method: "HMAC-SHA1",
  oauth_timestamp: "1700000000",
  oauth_token: "accessToken123",
  oauth_version: "1.0",
};

describe("XService.generateSignature (OAuth 1.0a HMAC-SHA1)", () => {
  it("matches a known-good signature for fixed inputs", async () => {
    const signature = await XService.generateSignature(
      "POST",
      "https://api.twitter.com/2/tweets",
      FIXED_PARAMS,
      "consumerSecret456",
      "accessSecret456"
    );
    expect(signature).toBe("megkeM982V59AHEJdDP1VKA4C1o=");
  });

  it("changes when a param value changes", async () => {
    const baseline = await XService.generateSignature(
      "POST",
      "https://api.twitter.com/2/tweets",
      FIXED_PARAMS,
      "consumerSecret456",
      "accessSecret456"
    );
    const tampered = await XService.generateSignature(
      "POST",
      "https://api.twitter.com/2/tweets",
      { ...FIXED_PARAMS, oauth_nonce: "tampered-nonce" },
      "consumerSecret456",
      "accessSecret456"
    );
    expect(tampered).not.toBe(baseline);
  });
});
