import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { access, constants as fsConstants, mkdir, writeFile } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { PassThrough, Readable } from "stream";
import { ENV } from "../_core/env";
import { isValidYouTubeUrl, extractVideoId } from "./youtube";

const require = createRequire(import.meta.url);
let generatedCookiesPathPromise: Promise<string | null> | null = null;

export interface ConversionProgress {
  state: "analyzing" | "downloading" | "converting";
  progress: number; // 0-100
}

export interface VideoInfo {
  title: string;
  duration: number; // in seconds
  videoId: string;
}

function getManagedYtDlpPath(): string {
  return path.resolve(
    process.cwd(),
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
  );
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
  const managedBinaryPath = getManagedYtDlpPath();

  try {
    await access(managedBinaryPath, fsConstants.X_OK);
    return managedBinaryPath;
  } catch {
    // Fall back to the package-managed binary next.
  }

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
    "yt-dlp no está disponible. Instala el binario del sistema o ejecuta `pnpm yt-dlp:install`."
  );
}

function createMissingCookiesError(): Error {
  return new Error(
    "YouTube requiere una sesion autenticada. Define YTDLP_COOKIES_BASE64 (recomendado) o YTDLP_COOKIES_PATH en el servidor."
  );
}

function normalizeSpawnError(error: Error): Error {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return createMissingYtDlpError();
  }

  return error;
}

async function resolveYtDlpCookiesPath(): Promise<string | null> {
  if (ENV.ytDlpCookiesPath) {
    try {
      await access(ENV.ytDlpCookiesPath, fsConstants.R_OK);
      return ENV.ytDlpCookiesPath;
    } catch {
      throw new Error(
        `YTDLP_COOKIES_PATH no es legible: ${ENV.ytDlpCookiesPath}`
      );
    }
  }

  if (!ENV.ytDlpCookiesBase64 && !ENV.ytDlpCookies) {
    return null;
  }

  if (!generatedCookiesPathPromise) {
    generatedCookiesPathPromise = (async () => {
      const cookiesDir = path.resolve(process.cwd(), "tmp");
      const cookiesPath = path.join(cookiesDir, "yt-dlp-cookies.txt");
      const rawCookies = ENV.ytDlpCookiesBase64
        ? Buffer.from(ENV.ytDlpCookiesBase64, "base64").toString("utf8")
        : ENV.ytDlpCookies;

      await mkdir(cookiesDir, { recursive: true });
      await writeFile(cookiesPath, rawCookies, "utf8");
      return cookiesPath;
    })();
  }

  return generatedCookiesPathPromise;
}

async function spawnYtDlp(
  args: string[],
  options: { includeCookies?: boolean } = {}
): Promise<ChildProcessWithoutNullStreams> {
  const includeCookies = options.includeCookies ?? true;
  const command = await resolveYtDlpCommand();
  const cookiesPath = includeCookies ? await resolveYtDlpCookiesPath() : null;
  const finalArgs = cookiesPath ? ["--cookies", cookiesPath, ...args] : args;
  const process = spawn(command, finalArgs);

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

function formatYtDlpFailure(stderrOutput: string, fallbackMessage: string): Error {
  const cleanedMessage = stderrOutput
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" | ");

  if (!cleanedMessage) {
    return new Error(fallbackMessage);
  }

  if (
    /sign in to confirm you'?re not a bot/i.test(cleanedMessage) &&
    !ENV.ytDlpCookiesPath &&
    !ENV.ytDlpCookiesBase64 &&
    !ENV.ytDlpCookies
  ) {
    return createMissingCookiesError();
  }

  return new Error(`${fallbackMessage}: ${cleanedMessage}`);
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
    "--ignore-config",
    "--no-playlist",
    "--skip-download",
    "--dump-single-json",
    "--quiet",
    "--no-warnings",
    url,
  ]);

  return new Promise((resolve, reject) => {
    let output = "";
    let stderrOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      console.error("[Converter] yt-dlp stderr:", chunk);
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(
          formatYtDlpFailure(
            stderrOutput,
            "No se pudo obtener información del video"
          )
        );
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

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("No se pudo extraer el ID del video");
  }

  try {
    let videoInfo: VideoInfo;
    try {
      videoInfo = await getVideoInfo(url);
    } catch (error) {
      console.warn(
        "[Converter] Metadata fallback activated, using video ID as filename seed:",
        error
      );
      videoInfo = {
        title: videoId,
        duration: 0,
        videoId,
      };
    }

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
      "--ignore-config",
      "--no-playlist",
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
      url,
    ]);

    const outputStream = new PassThrough();
    let stderrOutput = "";
    let stdoutEnded = false;
    let processClosed = false;
    let exitCode: number | null = null;

    const finalizeSuccessIfReady = () => {
      if (stdoutEnded && processClosed && exitCode === 0) {
        outputStream.end();
      }
    };

    // Handle errors
    ytdlpProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      console.error("[Converter] yt-dlp stderr:", chunk);
    });

    ytdlpProcess.stdout.on("data", (chunk) => {
      outputStream.write(chunk);
    });

    ytdlpProcess.stdout.on("end", () => {
      stdoutEnded = true;
      finalizeSuccessIfReady();
    });

    ytdlpProcess.stdout.on("error", (error) => {
      outputStream.destroy(error);
    });

    ytdlpProcess.on("close", (code) => {
      processClosed = true;
      exitCode = code;

      if (code !== 0) {
        console.error(`[Converter] yt-dlp exited with code ${code}`);
        outputStream.destroy(
          formatYtDlpFailure(stderrOutput, "Error durante la conversión a MP3")
        );
        return;
      }

      finalizeSuccessIfReady();
    });

    return {
      stream: outputStream,
      filename,
      videoInfo,
    };
  } catch (error) {
    console.error("[Converter] Error converting to MP3:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Error durante la conversión a MP3");
  }
}

/**
 * Validate if yt-dlp is installed and working
 */
export async function validateYtDlpInstallation(): Promise<boolean> {
  try {
    const process = await spawnYtDlp(["--version"], { includeCookies: false });
    return await new Promise((resolve) => {
      process.on("close", (code) => {
        resolve(code === 0);
      });
    });
  } catch {
    return false;
  }
}
