"use client";

import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useId, useState } from "react";

const MAX_IMAGES = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const placeholderPath = "/demo/product-placeholder.svg";

interface UploadedImage {
  readonly originalName: string;
  readonly path: string;
  readonly persisted?: boolean;
}

function readUploadResponse(value: unknown): readonly UploadedImage[] | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("images" in value) ||
    !Array.isArray(value.images)
  ) {
    return null;
  }
  const images = value.images.filter(
    (image): image is UploadedImage =>
      Boolean(
        image &&
          typeof image === "object" &&
          "originalName" in image &&
          typeof image.originalName === "string" &&
          "path" in image &&
          typeof image.path === "string" &&
          image.path.startsWith("/api/product-images/"),
      ),
  );
  return images.length === value.images.length ? images : null;
}

export function AdminProductImageUploader({
  serverError,
  initialImages = [],
}: {
  readonly serverError?: string;
  readonly initialImages?: readonly UploadedImage[];
}) {
  const inputId = useId();
  const [images, setImages] = useState<readonly UploadedImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: readonly File[]): Promise<void> {
    setError(null);
    if (files.length === 0) return;
    if (files.length + images.length > MAX_IMAGES) {
      setError("Vous pouvez importer au maximum " + MAX_IMAGES + " images.");
      return;
    }
    if (files.some((file) => file.size < 1 || file.size > MAX_FILE_BYTES)) {
      setError("Chaque image doit peser au maximum 8 Mo.");
      return;
    }

    setUploading(true);
    const body = new FormData();
    for (const file of files) body.append("images", file);

    try {
      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-EDebou-Admin-CSRF": "1" },
        body,
      });
      const value: unknown = await response.json().catch(() => null);
      const uploaded = readUploadResponse(value);
      if (!response.ok || !uploaded) {
        throw new Error("UPLOAD_FAILED");
      }
      setImages((current) => [...current, ...uploaded]);
    } catch {
      setError(
        "Import impossible. Utilisez des images JPG, PNG, WebP, AVIF ou HEIC de 8 Mo maximum.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function remove(image: UploadedImage): Promise<void> {
    setError(null);
    if (image.persisted) {
      setImages((current) => current.filter((candidate) => candidate.path !== image.path));
      return;
    }
    try {
      const response = await fetch("/api/admin/product-images", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-EDebou-Admin-CSRF": "1",
        },
        body: JSON.stringify({ path: image.path }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("DELETE_FAILED");
      }
      setImages((current) =>
        current.filter((candidate) => candidate.path !== image.path),
      );
    } catch {
      setError("Cette image n’a pas pu être retirée. Réessayez.");
    }
  }

  function move(path: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.path === path);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  }

  const submittedImages =
    images.length > 0
      ? images
      : [{ path: placeholderPath, originalName: "Visuel provisoire EDebou" }];

  return (
    <div className="grid gap-4 md:col-span-2">
      {submittedImages.map((image) => (
        <input
          key={image.path}
          type="hidden"
          name="imagePaths"
          value={image.path}
        />
      ))}
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-zinc-950">Photos du produit</p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Jusqu’à 8 photos depuis votre téléphone ou ordinateur. Elles sont
            réorientées et optimisées automatiquement, sans être rognées. La première photo est l’image principale.
          </p>
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-brand"
        >
          {uploading ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-5" aria-hidden="true" />
          )}
          {uploading ? "Import en cours…" : "Importer des photos"}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          disabled={uploading || images.length >= MAX_IMAGES}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            void upload(files);
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {submittedImages.map((image, index) => {
          const isPlaceholder = image.path === placeholderPath;
          return (
            <article
              key={image.path}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              <div className="flex aspect-square items-center justify-center bg-zinc-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.path}
                  alt={
                    isPlaceholder
                      ? "Visuel provisoire"
                      : "Photo produit " + (index + 1)
                  }
                  width="500"
                  height="500"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex min-h-12 items-center gap-2 border-t border-zinc-100 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-600">
                  {isPlaceholder ? "Visuel provisoire" : image.originalName}
                </span>
                {!isPlaceholder ? (
                  <div className="flex shrink-0 items-center">
                    <button type="button" disabled={index === 0} onClick={() => move(image.path, -1)} aria-label={`Avancer ${image.originalName}`} className="inline-flex size-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 disabled:opacity-30">
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" disabled={index === images.length - 1} onClick={() => move(image.path, 1)} aria-label={`Reculer ${image.originalName}`} className="inline-flex size-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 disabled:opacity-30">
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(image)}
                      className="inline-flex size-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                      aria-label={"Retirer " + image.originalName}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {error || serverError ? (
        <p role="alert" className="text-sm font-bold text-red-700">
          {error ?? serverError}
        </p>
      ) : null}
    </div>
  );
}
