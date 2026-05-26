import path from "path";
import { promises as fs } from "fs";

type StorageDriver = "local" | "vercel-blob";

type SaveFileInput = {
  pathname: string;
  data: Buffer;
  contentType: string;
};

export function getStorageDriver(): StorageDriver {
  const value = String(process.env.FILE_STORAGE_DRIVER ?? "")
    .trim()
    .toLowerCase();

  if (value === "vercel-blob" || value === "blob") return "vercel-blob";

  return "local";
}

function normalizePathname(pathname: string) {
  return pathname.replace(/^\/+/, "").replace(/\\/g, "/");
}

function publicPath(pathname: string) {
  return `/${normalizePathname(pathname)}`;
}

function localFullPath(pathname: string) {
  return path.join(process.cwd(), "public", normalizePathname(pathname));
}

export async function saveUploadedFile(input: SaveFileInput) {
  const pathname = normalizePathname(input.pathname);

  if (getStorageDriver() === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, input.data, {
      access: "public",
      contentType: input.contentType,
    });

    return blob.url;
  }

  const fullPath = localFullPath(pathname);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.data);
  return publicPath(pathname);
}

export async function deleteStoredFile(filePath: string) {
  if (!filePath) return;

  if (/^https?:\/\//i.test(filePath)) {
    const { del } = await import("@vercel/blob");
    await del(filePath);
    return;
  }

  await fs.unlink(localFullPath(filePath));
}

export async function deleteLocalUploadDirectory(pathname: string) {
  await fs.rm(localFullPath(pathname), { recursive: true, force: true });
}
