import type { Express } from "express";
import { saveConversion, updateConversionStatus } from "./db";
import { AUTH_ENABLED } from "./_core/env";
import { sdk } from "./_core/sdk";
import { convertToMP3Stream } from "./utils/converter";
import { isValidYouTubeUrl, normalizeYouTubeUrl } from "./utils/youtube";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

function getInsertId(result: unknown): number | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const insertId = (result as { insertId?: unknown }).insertId;
  return typeof insertId === "number" ? insertId : undefined;
}

async function markConversionSuccess(conversionId: number | undefined) {
  if (conversionId === undefined) return;

  try {
    await updateConversionStatus(conversionId, "success");
  } catch (error) {
    console.error("[Download] Failed to mark conversion as success:", error);
  }
}

async function markConversionFailure(
  conversionId: number | undefined,
  error: unknown
) {
  if (conversionId === undefined) return;

  try {
    await updateConversionStatus(conversionId, "failed", {
      errorMessage: getErrorMessage(error),
    });
  } catch (updateError) {
    console.error("[Download] Failed to mark conversion as failed:", updateError);
  }
}

export function registerDownloadRoute(app: Express) {
  app.get("/api/download-mp3", async (req, res) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";

    if (!rawUrl) {
      res.status(400).json({ error: "URL de YouTube requerida" });
      return;
    }

    if (!isValidYouTubeUrl(rawUrl)) {
      res.status(400).json({ error: "URL de YouTube inválida" });
      return;
    }

    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    if (AUTH_ENABLED) {
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Debes iniciar sesión para descargar" });
        return;
      }
    }

    let conversionId: number | undefined;

    try {
      const youtubeUrl = normalizeYouTubeUrl(rawUrl);

      if (user) {
        const saveResult = await saveConversion({
          userId: user.id,
          youtubeUrl,
          status: "pending",
        });
        conversionId = getInsertId(saveResult);
      }

      const { stream, filename, videoInfo } = await convertToMP3Stream(youtubeUrl);

      if (conversionId !== undefined) {
        await updateConversionStatus(conversionId, "pending", {
          videoTitle: videoInfo.title,
          videoId: videoInfo.videoId,
          duration: videoInfo.duration,
        });
      }

      let streamEnded = false;

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");

      stream.once("end", () => {
        streamEnded = true;
        void markConversionSuccess(conversionId);
      });

      stream.once("error", (error) => {
        void markConversionFailure(conversionId, error);

        if (!res.headersSent) {
          res.status(500).json({ error: "Error durante la conversión a MP3" });
          return;
        }

        res.destroy(error as Error);
      });

      res.once("close", () => {
        if (!streamEnded) {
          stream.destroy();
        }
      });

      stream.pipe(res);
    } catch (error) {
      await markConversionFailure(conversionId, error);
      console.error("[Download] Failed to process download:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
}
