import path from "path";
import { promises as fs } from "fs";

type StorageDriver = "local" | "vercel-blob";

type SaveFileInput = {
  pathname: string;
  data: Buffer;
  contentType: string;
};

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export function getStorageDriver(): StorageDriver {
  const value = String(process.env.FILE_STORAGE_DRIVER ?? "")
    .trim()
    .toLowerCase();

  if (value === "vercel-blob" || value === "blob") return "vercel-blob";
  if (value === "local") return "local";

  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.VERCEL) return "vercel-blob";

  return "local";
}

export function getStorageConfigStatus() {
  const driver = getStorageDriver();
  const isVercel = Boolean(process.env.VERCEL);
  const blobTokenPresent = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const ok = driver === "local" ? !isVercel : blobTokenPresent;

  return {
    ok,
    driver,
    isVercel,
    blobTokenPresent,
    message: ok
      ? null
      : driver === "vercel-blob"
        ? "BLOB_READ_WRITE_TOKEN is required when using Vercel Blob storage."
        : "Local upload storage is not writable on Vercel. Use Vercel Blob or run on a writable local server.",
  };
}

export function isStorageConfigurationError(
  error: unknown,
): error is StorageConfigurationError {
  return error instanceof StorageConfigurationError;
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

function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageConfigurationError(
      "BLOB_READ_WRITE_TOKEN is missing. Create/connect a Vercel Blob store and redeploy the app.",
    );
  }
}

export async function saveUploadedFile(input: SaveFileInput) {
  const pathname = normalizePathname(input.pathname);

  if (getStorageDriver() === "vercel-blob") {
    assertBlobConfigured();

    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, input.data, {
      access: "public",
      contentType: input.contentType,
    });

    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new StorageConfigurationError(
      "Local upload storage is not writable on Vercel. Set FILE_STORAGE_DRIVER=vercel-blob and BLOB_READ_WRITE_TOKEN, then redeploy.",
    );
  }

  const fullPath = localFullPath(pathname);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.data);
  return publicPath(pathname);
}

export async function deleteStoredFile(filePath: string) {
  if (!filePath) return;

  if (/^https?:\/\//i.test(filePath)) {
    assertBlobConfigured();

    const { del } = await import("@vercel/blob");
    await del(filePath);
    return;
  }

  await fs.unlink(localFullPath(filePath));
}

export async function deleteLocalUploadDirectory(pathname: string) {
  await fs.rm(localFullPath(pathname), { recursive: true, force: true });
}
