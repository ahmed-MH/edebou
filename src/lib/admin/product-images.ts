import "server-only";

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve } from "node:path";

import sharp from "sharp";

export const MAX_PRODUCT_IMAGE_COUNT = 8;
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PRODUCT_UPLOAD_BODY_BYTES =
  MAX_PRODUCT_IMAGE_COUNT * MAX_PRODUCT_IMAGE_BYTES + 1024 * 1024;

const filenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/u;
const publicPathPattern =
  /^\/api\/product-images\/([0-9a-f-]{36}\.webp)$/u;
const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

export interface SavedProductImage {
  readonly originalName: string;
  readonly path: string;
}

function imageDirectory(): string {
  const configured = process.env.PRODUCT_UPLOAD_DIR?.trim();
  const directory = configured
    ? isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured)
    : join(process.cwd(), "storage", "product-images");

  if (directory === parse(directory).root) {
    throw new Error("Unsafe product image directory.");
  }
  return directory;
}

function filenameFromPublicPath(publicPath: string): string | null {
  const match = publicPathPattern.exec(publicPath);
  const filename = match?.[1];
  return filename && filenamePattern.test(filename) ? filename : null;
}

function imageFilePath(filename: string): string {
  if (!filenamePattern.test(filename)) {
    throw new Error("Invalid product image filename.");
  }
  const directory = imageDirectory();
  const target = join(directory, filename);
  const pathFromDirectory = relative(directory, target);
  if (
    pathFromDirectory.startsWith("..") ||
    isAbsolute(pathFromDirectory)
  ) {
    throw new Error("Unsafe product image path.");
  }
  return target;
}

async function removeFilename(filename: string): Promise<void> {
  try {
    await unlink(imageFilePath(filename));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

export async function saveProductImages(
  files: readonly File[],
): Promise<readonly SavedProductImage[]> {
  if (files.length < 1 || files.length > MAX_PRODUCT_IMAGE_COUNT) {
    throw new Error("INVALID_PRODUCT_IMAGE_COUNT");
  }
  for (const file of files) {
    if (
      file.size < 1 ||
      file.size > MAX_PRODUCT_IMAGE_BYTES ||
      !acceptedMimeTypes.has(file.type.toLowerCase())
    ) {
      throw new Error("INVALID_PRODUCT_IMAGE");
    }
  }

  const directory = imageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o750 });
  const savedFilenames: string[] = [];

  try {
    const saved: SavedProductImage[] = [];
    for (const file of files) {
      const input = Buffer.from(await file.arrayBuffer());
      const output = await sharp(input, {
        failOn: "error",
        limitInputPixels: 40_000_000,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: 2_400,
          height: 2_400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
      const filename = randomUUID() + ".webp";
      await writeFile(imageFilePath(filename), output, {
        flag: "wx",
        mode: 0o640,
      });
      savedFilenames.push(filename);
      saved.push({
        originalName: file.name.slice(0, 240),
        path: "/api/product-images/" + filename,
      });
    }
    return saved;
  } catch (error) {
    await Promise.allSettled(savedFilenames.map(removeFilename));
    throw error;
  }
}

export async function readProductImage(
  filename: string,
): Promise<Buffer | null> {
  try {
    return await readFile(imageFilePath(filename));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function deleteUnreferencedProductImage(
  publicPath: string,
): Promise<boolean> {
  const filename = filenameFromPublicPath(publicPath);
  if (!filename) return false;
  await removeFilename(filename);
  return true;
}

export async function deleteUploadedProductImages(
  publicPaths: readonly string[],
): Promise<void> {
  const filenames = publicPaths.flatMap((publicPath) => {
    const filename = filenameFromPublicPath(publicPath);
    return filename ? [filename] : [];
  });
  await Promise.allSettled(filenames.map(removeFilename));
}

export function isManagedProductImagePath(publicPath: string): boolean {
  return filenameFromPublicPath(publicPath) !== null;
}
