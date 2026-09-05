import { describe, expect, it } from "vitest";
import { buildStreamEmbed, matchesNotificationRules } from "../../../src/utils/stream-notification";

describe("matchesNotificationRules", () => {
  it("returns true when no rules are configured", () => {
    expect(matchesNotificationRules("Ranked grind", undefined)).toBe(true);
  });

  it("returns true when the rules list is empty", () => {
    expect(matchesNotificationRules("Ranked grind", [])).toBe(true);
  });

  it("returns true when the title contains one of the rules (case-insensitive)", () => {
    expect(matchesNotificationRules("Playing APEX LEGENDS tonight", ["apex", "valorant"])).toBe(true);
  });

  it("returns false when the title matches none of the rules", () => {
    expect(matchesNotificationRules("Just chatting", ["apex", "valorant"])).toBe(false);
  });
});

describe("buildStreamEmbed", () => {
  const baseStreamInfo = {
    id: "s1",
    user_id: "u1",
    user_name: "streamer_one",
    game_name: "Apex Legends",
    title: "Ranked grind",
    thumbnail_url: "https://example.com/thumb.jpg",
    started_at: "2026-09-05T00:00:00Z",
    tags: ["FPS", "Ranked"],
  };
  const streamUrl = "https://twitch.tv/streamer_one";

  it("builds an embed with author, title, url, color and thumbnail", () => {
    const embed = buildStreamEmbed(baseStreamInfo, streamUrl);

    expect(embed.author).toEqual({ name: "streamer_one" });
    expect(embed.title).toBe("Ranked grind");
    expect(embed.url).toBe(streamUrl);
    expect(embed.color).toBe(0x6441a4);
    expect(embed.image).toEqual({ url: "https://example.com/thumb.jpg" });
  });

  it("joins multiple tags with a comma in the TAG field", () => {
    const embed = buildStreamEmbed(baseStreamInfo, streamUrl);
    const tagField = embed.fields?.find((f) => f.name === "TAG");

    expect(tagField?.value).toBe("FPS, Ranked");
  });

  it("shows a placeholder in the TAG field when there are no tags", () => {
    const embed = buildStreamEmbed({ ...baseStreamInfo, tags: [] }, streamUrl);
    const tagField = embed.fields?.find((f) => f.name === "TAG");

    expect(tagField?.value).toBe("-");
  });

  it("shows a placeholder in the GAME field when game_name is empty", () => {
    const embed = buildStreamEmbed({ ...baseStreamInfo, game_name: "" }, streamUrl);
    const gameField = embed.fields?.find((f) => f.name === "GAME");

    expect(gameField?.value).toBe("未設定");
  });
});
