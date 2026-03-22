function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sanitizeHeaderFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function createAsciiFilenameFallback(filename: string): string {
  const trimmedFilename = filename.trim();
  if (!trimmedFilename) {
    return "audio.mp3";
  }

  const extensionSeparatorIndex = trimmedFilename.lastIndexOf(".");
  const hasExtension =
    extensionSeparatorIndex > 0 &&
    extensionSeparatorIndex < trimmedFilename.length - 1;

  const rawBaseName = hasExtension
    ? trimmedFilename.slice(0, extensionSeparatorIndex)
    : trimmedFilename;
  const rawExtension = hasExtension
    ? trimmedFilename.slice(extensionSeparatorIndex)
    : "";

  const baseName =
    sanitizeHeaderFilenamePart(rawBaseName).replace(/[. ]+$/g, "") || "audio";
  const extension = sanitizeHeaderFilenamePart(rawExtension).replace(/ /g, "");

  return `${baseName}${extension}`;
}

export function buildAttachmentContentDisposition(filename: string): string {
  const safeFilename = filename.trim() || "audio.mp3";
  const fallbackFilename = createAsciiFilenameFallback(safeFilename);
  const encodedFilename = encodeRFC5987Value(safeFilename);

  return `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`;
}
