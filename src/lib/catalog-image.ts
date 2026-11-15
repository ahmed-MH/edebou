/** Only same-origin paths are accepted for public catalog media. */
export function isSafeLocalCatalogImagePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }

  try {
    const url = new URL(path, "https://edebou.local");
    return (
      url.origin === "https://edebou.local" &&
      !/[\u0000-\u001f\u007f]/u.test(path)
    );
  } catch {
    return false;
  }
}
