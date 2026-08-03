import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getEnv } from "../config/env";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function uploadsRoot() {
  return (
    process.env.UPLOADS_DIR?.trim() ||
    path.resolve(process.cwd(), "uploads")
  );
}

export function mediaPublicBase() {
  return getEnv().apiPublicUrl.replace(/\/$/, "");
}

export function mediaUrl(...parts: string[]) {
  const joined = parts.join("/");
  return `${mediaPublicBase()}/media/${joined}`;
}

export function assertImageFile(file: Express.Multer.File) {
  if (!ALLOWED.has(file.mimetype)) {
    throw new Error("FORMATO_INVALIDO");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ARCHIVO_GRANDE");
  }
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

/** Optimiza a WebP: max width + thumb */
export async function saveOptimizedImage(input: {
  buffer: Buffer;
  relativeDir: string; // tenantId/sede o tenantId/salas/salaId
  basename?: string;
}): Promise<{ url: string; thumbUrl: string; filename: string }> {
  const id = input.basename ?? randomUUID();
  const filename = `${id}.webp`;
  const thumbName = `${id}-thumb.webp`;
  const absDir = path.join(uploadsRoot(), ...input.relativeDir.split("/"));
  await ensureDir(absDir);

  const full = await sharp(input.buffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const thumb = await sharp(input.buffer)
    .rotate()
    .resize({
      width: 480,
      height: 480,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  await Promise.all([
    writeFile(path.join(absDir, filename), full),
    writeFile(path.join(absDir, thumbName), thumb),
  ]);

  const parts = input.relativeDir.split("/");
  return {
    filename,
    url: mediaUrl(...parts, filename),
    thumbUrl: mediaUrl(...parts, thumbName),
  };
}

export async function tryDeleteMediaFile(url: string | null | undefined) {
  if (!url) return;
  const marker = "/media/";
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const rel = decodeURIComponent(url.slice(idx + marker.length));
  if (rel.includes("..")) return;
  const abs = path.join(uploadsRoot(), rel);
  const root = uploadsRoot();
  if (!abs.startsWith(root)) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore */
  }
  // thumb companion
  if (abs.endsWith(".webp") && !abs.endsWith("-thumb.webp")) {
    try {
      await unlink(abs.replace(/\.webp$/, "-thumb.webp"));
    } catch {
      /* ignore */
    }
  }
}
