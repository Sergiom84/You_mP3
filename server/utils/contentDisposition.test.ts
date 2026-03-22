import { describe, expect, it } from "vitest";
import { buildAttachmentContentDisposition } from "./contentDisposition";

describe("buildAttachmentContentDisposition", () => {
  it("creates an ASCII fallback and keeps the UTF-8 filename encoded", () => {
    expect(buildAttachmentContentDisposition("Canción 🎵.mp3")).toBe(
      `attachment; filename="Cancion.mp3"; filename*=UTF-8''Canci%C3%B3n%20%F0%9F%8E%B5.mp3`
    );
  });

  it("falls back to a generic ASCII name when the title has no ASCII base", () => {
    expect(buildAttachmentContentDisposition("你好.mp3")).toBe(
      `attachment; filename="audio.mp3"; filename*=UTF-8''%E4%BD%A0%E5%A5%BD.mp3`
    );
  });
});
