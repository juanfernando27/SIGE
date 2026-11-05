let csrf = "";
let refreshing: Promise<void> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: any[] = [],
  ) {
    super(message);
  }
}
export async function request(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<any> {
  const form = options.body instanceof FormData;
  const method = options.method || "GET";
  if (method !== "GET" && !csrf) {
    const r = await fetch("/api/auth/csrf", { credentials: "same-origin" });
    const v = await r.json();
    csrf = v.data.csrfToken;
  }
  const response = await fetch("/api" + path, {
    signal: AbortSignal.timeout(20000),
    ...options,
    credentials: "same-origin",
    headers: {
      ...(!form && options.body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const value = await response.json();
  if (value.data?.csrfToken) csrf = value.data.csrfToken;
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/refresh")
  ) {
    try {
      if (!refreshing)
        refreshing = request("/auth/refresh", { method: "POST" }, false)
          .then(() => {})
          .finally(() => {
            refreshing = null;
          });
      await refreshing;
      return request(path, options, false);
    } catch {
      window.dispatchEvent(new Event("session-expired"));
    }
  }
  if (!response.ok)
    throw new ApiError(
      value.error?.message || "No se pudo completar la operación.",
      response.status,
      value.error?.details || [],
    );
  return value;
}
export const get = (p: string) => request(p);
export const send = (p: string, data?: unknown, method = "POST") =>
  request(p, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
export async function choices(entity: string) {
  const result: any[] = [];
  const filter = ["sales", "purchases"].includes(entity)
    ? ""
    : "&status=active";
  for (let page = 1; ; page++) {
    const r = await get(`/${entity}?pageSize=100&page=${page}${filter}`);
    result.push(...r.data);
    if (result.length >= r.meta.total) break;
  }
  return result;
}
export const cop = (v: unknown) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
export const date = (v: unknown) =>
  v
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(v)))
    : "—";

export async function download(path: string) {
  await get("/auth/me"); // Renew an expired access cookie before requesting binary content.
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(28000),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw new ApiError(
      value.error?.message || "No se pudo descargar el archivo.",
      response.status,
    );
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = encoded
    ? decodeURIComponent(encoded)
    : disposition.match(/filename="?([^";]+)"?/i)?.[1] || "sige-descarga";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
