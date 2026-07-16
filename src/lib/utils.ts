import { randomUUID } from "crypto";

/** Removes path separators and unsafe characters from a user-supplied filename. */
export function safeFilename(original: string): string {
  const base = original
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(-120);
  return base.length > 0 ? base : "file";
}

/** Builds the storage key for an original image, preventing path traversal. */
export function buildOriginalKey(objectId: string, filename: string, date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const uuid = randomUUID();
  const safe = safeFilename(filename);
  return `objects/${sanitizeId(objectId)}/originals/${year}/${month}/${uuid}-${safe}`;
}

/** Builds the storage key for a generated preview image. */
export function buildPreviewKey(objectId: string, date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const uuid = randomUUID();
  return `objects/${sanitizeId(objectId)}/previews/${year}/${month}/${uuid}.webp`;
}

/** Ids come from Prisma (cuid) - still defensively strip anything that isn't alnum. */
function sanitizeId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) throw new Error("Invalid id");
  return clean;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const TASHKENT_TZ = "Asia/Tashkent";

export function formatDateTashkent(date: Date): string {
  return new Intl.DateTimeFormat("uz-Latn", {
    timeZone: TASHKENT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTimeTashkent(date: Date): string {
  return new Intl.DateTimeFormat("uz-Latn", {
    timeZone: TASHKENT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delayMs = 300 }: { attempts?: number; delayMs?: number } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}
