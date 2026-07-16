import { createHash } from "crypto";
import sharp from "sharp";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface PreviewResult {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
}

/** Generates a max-1600px-edge WEBP preview for fast Telegram/browser viewing. */
export async function generatePreview(original: Buffer): Promise<PreviewResult> {
  const image = sharp(original, { failOn: "none" }).rotate();
  const resized = image.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
  const buffer = await resized.webp({ quality: 78 }).toBuffer();
  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    contentType: "image/webp",
  };
}

export async function readDimensions(buffer: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

export function isSupportedImageMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

export function guessMimeFromFilename(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return null;
  }
}
