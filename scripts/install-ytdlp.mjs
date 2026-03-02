import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE_API_URL = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

function getTargetAssetName() {
  if (process.platform === "win32") {
    return "yt-dlp.exe";
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return "yt-dlp_linux_aarch64";
    }

    return "yt-dlp_linux";
  }

  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "yt-dlp_macos" : "yt-dlp_macos_legacy";
  }

  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

function getOutputFilename() {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      "User-Agent": "you-mp3-installer",
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo consultar GitHub (${response.status} ${response.statusText})`
    );
  }

  return response.json();
}

async function downloadBinary(downloadUrl) {
  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "you-mp3-installer",
    },
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo descargar yt-dlp (${response.status} ${response.statusText})`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const assetName = getTargetAssetName();
  const outputDir = path.resolve(process.cwd(), "bin");
  const outputPath = path.join(outputDir, getOutputFilename());

  const release = await fetchLatestRelease();
  const asset = release.assets?.find((item) => item.name === assetName);

  if (!asset?.browser_download_url) {
    throw new Error(`No se encontro el asset ${assetName} en la release actual de yt-dlp`);
  }

  const binary = await downloadBinary(asset.browser_download_url);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, binary);

  if (process.platform !== "win32") {
    await chmod(outputPath, 0o755);
  }

  console.log(`[yt-dlp] Instalado ${assetName} en ${outputPath}`);
}

main().catch((error) => {
  console.error("[yt-dlp] Fallo al instalar el binario:", error);
  process.exit(1);
});
