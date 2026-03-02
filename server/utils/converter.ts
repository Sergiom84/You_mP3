import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { access, constants as fsConstants } from "fs/promises";
import { createRequire } from "module";
import { Readable } from "stream";
import { isValidYouTubeUrl, extractVideoId } from "./youtube";

const require = createRequire(import.meta.url);

export interface ConversionProgress {
  state: "analyzing" | "downloading" | "converting";
  progress: number; // 0-100
}

export interface VideoInfo {
  title: string;
  duration: number; // in seconds
  videoId: string;
}

function getBundledYtDlpPath(): string | null {
  try {
    const { YOUTUBE_DL_PATH } = require("yt-dlp-exec/src/constants");
    return typeof YOUTUBE_DL_PATH === "string" ? YOUTUBE_DL_PATH : null;
  } catch {
    return null;
  }
}

async function resolveYtDlpCommand(): Promise<string> {
  const bundledBinaryPath = getBundledYtDlpPath();

  if (bundledBinaryPath) {
    try {
      await access(bundledBinaryPath, fsConstants.X_OK);
      return bundledBinaryPath;
    } catch {
      // Fall back to a globally installed yt-dlp binary.
    }
  }

  return "yt-dlp";
}

function createMissingYtDlpError(): Error {
  return new Error(
    "yt-dlp no está disponible. Instala el binario del sistema o ejecuta `pnpm yt-dlp:install` (si tu entorno bloquea scripts, permite también `yt-dlp-exec`)."
  );
}

function normalizeSpawnError(error: Error): Error {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return createMissingYtDlpError();
  }

  return error;
}

async function spawnYtDlp(
  args: string[]
): Promise<ChildProcessWithoutNullStreams> {
  const command = await resolveYtDlpCommand();
  const process = spawn(command, args);

  await new Promise<void>((resolve, reject) => {
    const handleSpawn = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(normalizeSpawnError(error));
    };
    const cleanup = () => {
      process.off("spawn", handleSpawn);
      process.off("error", handleError);
    };

    process.once("spawn", handleSpawn);
    process.once("error", handleError);
  });

  return process;
}

/**
 * Get video information from YouTube URL without downloading
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  if (!isValidYouTubeUrl(url)) {
    throw new Error("URL de YouTube inválida");
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("No se pudo extraer el ID del video");
  }

  const process = await spawnYtDlp([
    url,
    "--dump-json",
    "--quiet",
    "--no-warnings",
  ]);

  return new Promise((resolve, reject) => {
    let output = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      console.error("[Converter] yt-dlp stderr:", data.toString());
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("No se pudo obtener información del video"));
        return;
      }

      try {
        const info = JSON.parse(output);
        resolve({
          title: info.title || "Unknown",
          duration: info.duration || 0,
          videoId,
        });
      } catch {
        reject(new Error("Error al procesar información del video"));
      }
    });
  });
}

/**
 * Convert YouTube video to MP3 and return as stream
 * Returns both the stream and metadata about the conversion
 */
export async function convertToMP3Stream(
  url: string
): Promise<{
  stream: Readable;
  filename: string;
  videoInfo: VideoInfo;
}> {
  if (!isValidYouTubeUrl(url)) {
    throw new Error("URL de YouTube inválida");
  }

  try {
    // Get video info first
    const videoInfo = await getVideoInfo(url);

    // Create a safe filename from the title
    const safeTitle = videoInfo.title
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .toLowerCase()
      .slice(0, 100) || "audio";

    const filename = `${safeTitle}.mp3`;

    // Execute yt-dlp to extract audio as MP3 and stream to stdout
    const ytdlpProcess = await spawnYtDlp([
      url,
      "-f",
      "bestaudio/best",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "192K",
      "-o",
      "-",
      "--quiet",
      "--no-warnings",
    ]);

    // Handle errors
    ytdlpProcess.stderr.on("data", (data) => {
      console.error("[Converter] yt-dlp stderr:", data.toString());
    });
    ytdlpProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`[Converter] yt-dlp exited with code ${code}`);
      }
    });

    return {
      stream: ytdlpProcess.stdout,
      filename,
      videoInfo,
    };
  } catch (error) {
    console.error("[Converter] Error converting to MP3:", error);
    throw new Error("Error durante la conversión a MP3");
  }
}

/**
 * Validate if yt-dlp is installed and working
 */
export async function validateYtDlpInstallation(): Promise<boolean> {
  try {
    const process = await spawnYtDlp(["--version"]);
    return await new Promise((resolve) => {
      process.on("close", (code) => {
        resolve(code === 0);
      });
    });
  } catch {
    return false;
  }
}
