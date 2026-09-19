/** Cliente HTTP para componentes cliente: JSON + manejo de errores uniforme. */
export async function api<T = unknown>(
  url: string,
  options?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = options ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Error ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}
