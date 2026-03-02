import { describe, expect, it } from "vitest";
import { isValidYouTubeUrl, extractVideoId, normalizeYouTubeUrl } from "./youtube";

describe("YouTube URL Utilities", () => {
  describe("isValidYouTubeUrl", () => {
    it("should validate standard youtube.com watch URLs", () => {
      expect(
        isValidYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
      ).toBe(true);
    });

    it("should validate youtu.be short URLs", () => {
      expect(isValidYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    });

    it("should validate URLs without https protocol", () => {
      expect(isValidYouTubeUrl("www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    });

    it("should validate youtube.com/embed URLs", () => {
      expect(
        isValidYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")
      ).toBe(true);
    });

    it("should validate youtube.com/v URLs", () => {
      expect(isValidYouTubeUrl("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe(
        true
      );
    });

    it("should reject invalid URLs", () => {
      expect(isValidYouTubeUrl("https://example.com")).toBe(false);
    });

    it("should reject empty strings", () => {
      expect(isValidYouTubeUrl("")).toBe(false);
    });

    it("should reject null or undefined", () => {
      expect(isValidYouTubeUrl(null as any)).toBe(false);
      expect(isValidYouTubeUrl(undefined as any)).toBe(false);
    });
  });

  describe("extractVideoId", () => {
    it("should extract video ID from standard youtube.com URL", () => {
      expect(
        extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
      ).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from youtu.be URL", () => {
      expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
        "dQw4w9WgXcQ"
      );
    });

    it("should extract video ID from embed URL", () => {
      expect(
        extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")
      ).toBe("dQw4w9WgXcQ");
    });

    it("should return null for invalid URLs", () => {
      expect(extractVideoId("https://example.com")).toBe(null);
    });

    it("should return null for empty strings", () => {
      expect(extractVideoId("")).toBe(null);
    });
  });

  describe("normalizeYouTubeUrl", () => {
    it("should normalize youtu.be URLs to standard format", () => {
      expect(normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
    });

    it("should keep standard URLs unchanged", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      expect(normalizeYouTubeUrl(url)).toBe(url);
    });

    it("should normalize embed URLs", () => {
      expect(
        normalizeYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")
      ).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });
  });
});
