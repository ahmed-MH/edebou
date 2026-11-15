import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import sharp from "sharp";

import {
  deleteUploadedProductImages,
  readProductImage,
  saveProductImages,
} from "../src/lib/admin/product-images";

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "edebou-product-images-"),
);
process.env.PRODUCT_UPLOAD_DIR = temporaryDirectory;

try {
  const source = await readFile(join(process.cwd(), "public/brand/app-icon.png"));
  const images = await saveProductImages([
    new File([source], "application-edebou.png", { type: "image/png" }),
  ]);
  assert.equal(images.length, 1);
  const image = images[0];
  assert.ok(image);
  const filename = image.path.split("/").at(-1);
  assert.ok(filename);

  const stored = await readProductImage(filename);
  assert.ok(stored);
  const metadata = await sharp(stored).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width ?? 0) <= 2_400);
  assert.ok((metadata.height ?? 0) <= 2_400);

  await deleteUploadedProductImages([image.path]);
  assert.equal(await readProductImage(filename), null);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write(
  "Product image verification passed: validation, conversion, orientation-safe resize and cleanup.\n",
);
