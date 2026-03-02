/**
 * YouTube URL validation and extraction utilities
 */

const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
];

/**
 * Validates if a URL is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  // Add https:// if no protocol is provided
  const urlToCheck = url.startsWith("http") ? url : `https://${url}`;

  try {
    new URL(urlToCheck);
  } catch {
    return false;
  }

  return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(urlToCheck));
}

/**
 * Extracts the video ID from a YouTube URL
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const urlToCheck = url.startsWith("http") ? url : `https://${url}`;

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = urlToCheck.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Normalizes a YouTube URL to standard format
 */
export function normalizeYouTubeUrl(url: string): string {
  const videoId = extractVideoId(url);
  if (!videoId) return url;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
