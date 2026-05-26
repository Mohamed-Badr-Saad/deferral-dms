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

function normalizeBlobError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/store does not exist/i.test(message)) {
    return new StorageConfigurationError(
      "The configured Vercel Blob store does not exist. Create/connect a Blob store in Vercel, replace BLOB_READ_WRITE_TOKEN, and redeploy the app.",
    );
  }

  if (/token|unauthorized|forbidden|access denied/i.test(message)) {
    return new StorageConfigurationError(
      "Vercel Blob rejected the configured token. Replace BLOB_READ_WRITE_TOKEN with a valid read/write token and redeploy the app.",
    );
  }

  return error;
}

export async function verifyStorageAccess() {
  const status = getStorageConfigStatus();
  if (!status.ok || status.driver !== "vercel-blob") {
    return { ...status, reachable: status.ok };
  }

  try {
    assertBlobConfigured();
    const { list } = await import("@vercel/blob");
    await list({ limit: 1 });
    return { ...status, reachable: true };
  } catch (error) {
    const normalized = normalizeBlobError(error);
    return {
      ...status,
      ok: false,
      reachable: false,
      message:
        normalized instanceof Error
          ? normalized.message
          : "Vercel Blob storage is not reachable.",
    };
  }
}

export async function saveUploadedFile(input: SaveFileInput) {
  const pathname = normalizePathname(input.pathname);

  if (getStorageDriver() === "vercel-blob") {
    assertBlobConfigured();

    let blob: { url: string };
    try {
      const { put } = await import("@vercel/blob");
      blob = await put(pathname, input.data, {
        access: "public",
        contentType: input.contentType,
      });
    } catch (error) {
      throw normalizeBlobError(error);
    }

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

    try {
      const { del } = await import("@vercel/blob");
      await del(filePath);
    } catch (error) {
      throw normalizeBlobError(error);
    }

    return;
  }

  await fs.unlink(localFullPath(filePath));
}

export async function deleteLocalUploadDirectory(pathname: string) {
  await fs.rm(localFullPath(pathname), { recursive: true, force: true });
}
