import { describe, expect, it } from "vitest";
import { DiscordService, type DiscordInteraction } from "../../../src/services/discord.service";

function buildAddStreamerInteraction(
  options: Array<{ name: string; type: number; value: string }>,
  invokerId = "invoker-id"
): DiscordInteraction {
  return {
    type: 2,
    id: "interaction-id",
    token: "interaction-token",
    data: { name: "add-streamer", options },
    user: { id: invokerId },
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateEd25519KeyPair() {
  return crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
}

async function signHex(privateKey: CryptoKey, message: string): Promise<string> {
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, new TextEncoder().encode(message));
  return toHex(new Uint8Array(signature));
}

async function publicKeyHex(publicKey: CryptoKey): Promise<string> {
  const raw = (await crypto.subtle.exportKey("raw", publicKey)) as ArrayBuffer;
  return toHex(new Uint8Array(raw));
}

describe("DiscordService.verifyInteraction (Ed25519)", () => {
  it("accepts a correctly signed interaction and parses the body", async () => {
    const { privateKey, publicKey } = await generateEd25519KeyPair();
    const timestamp = "1700000000";
    const body = JSON.stringify({ type: 1 });
    const signature = await signHex(privateKey, timestamp + body);
    const pubHex = await publicKeyHex(publicKey);

    const result = await DiscordService.verifyInteraction(signature, timestamp, body, pubHex);
    expect(result.isValid).toBe(true);
    expect(result.interaction).toEqual({ type: 1 });
  });

  it("rejects a tampered signature", async () => {
    const { privateKey, publicKey } = await generateEd25519KeyPair();
    const timestamp = "1700000000";
    const body = JSON.stringify({ type: 1 });
    const signature = await signHex(privateKey, timestamp + body);
    const pubHex = await publicKeyHex(publicKey);

    const tamperedSignature = signature.slice(0, -2) + (signature.slice(-2) === "00" ? "01" : "00");
    const result = await DiscordService.verifyInteraction(tamperedSignature, timestamp, body, pubHex);
    expect(result.isValid).toBe(false);
  });

  it("rejects a signature verified against the wrong public key", async () => {
    const { privateKey } = await generateEd25519KeyPair();
    const { publicKey: otherPublicKey } = await generateEd25519KeyPair();
    const timestamp = "1700000000";
    const body = JSON.stringify({ type: 1 });
    const signature = await signHex(privateKey, timestamp + body);
    const wrongPubHex = await publicKeyHex(otherPublicKey);

    const result = await DiscordService.verifyInteraction(signature, timestamp, body, wrongPubHex);
    expect(result.isValid).toBe(false);
  });
});

describe("DiscordService.validateCommand (/add-streamer)", () => {
  it("mentions the command invoker when no 'user' option is given (self-registration)", () => {
    const interaction = buildAddStreamerInteraction(
      [{ name: "twitch_username", type: 3, value: "some_streamer" }],
      "invoker-id"
    );

    const result = DiscordService.validateCommand(interaction);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe("invoker-id");
  });

  it("mentions the specified 'user' option instead of the invoker (proxy registration)", () => {
    const interaction = buildAddStreamerInteraction(
      [
        { name: "twitch_username", type: 3, value: "some_streamer" },
        { name: "user", type: 6, value: "actual-streamer-discord-id" },
      ],
      "invoker-id"
    );

    const result = DiscordService.validateCommand(interaction);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe("actual-streamer-discord-id");
  });
});
