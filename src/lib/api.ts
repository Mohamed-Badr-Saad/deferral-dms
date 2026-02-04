export async function api<T>(
  url: string,
  options?: RequestInit & { json?: any }
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: options?.json ? JSON.stringify(options.json) : options?.body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message ?? "Server error";
    const detail = data?.detail ? `: ${data.detail}` : "";
    throw new Error(`${msg}${detail}`);
  }

  return data as T;
}
