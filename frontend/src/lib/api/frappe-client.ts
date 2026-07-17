/**
 * Thin typed client over the Frappe REST/RPC surface exposed by the
 * healthcare_erp custom app (healthcare_erp.api.*).
 *
 * - In the browser, requests go to same-origin `/backend-api/method/...`,
 *   which `next.config.ts` rewrites to the Frappe site in dev, and Nginx
 *   proxies in production (see docker/nginx/nginx.conf) — so cookies/CSRF
 *   stay same-site and we never need CORS.
 * - Every mutating request carries Frappe's `X-Frappe-CSRF-Token`, read
 *   from the `csrf_token` cookie Frappe sets on login.
 */

export class FrappeApiError extends Error {
  httpStatus: number;
  serverMessages: string[];

  constructor(message: string, httpStatus: number, serverMessages: string[] = []) {
    super(message);
    this.name = "FrappeApiError";
    this.httpStatus = httpStatus;
    this.serverMessages = serverMessages;
  }
}

interface Envelope<T, M = Record<string, unknown>> {
  data: T;
  meta: M;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function request<T, M = Record<string, unknown>>(
  method: string,
  {
    query,
    body,
    httpMethod = "GET",
  }: { query?: Record<string, unknown>; body?: Record<string, unknown>; httpMethod?: string } = {}
): Promise<Envelope<T, M>> {
  const csrfToken = getCookie("csrf_token");

  const res = await fetch(`/backend-api/method/${method}${buildQuery(query)}`, {
    method: httpMethod,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new FrappeApiError(
      payload?.exception || payload?._server_messages || res.statusText,
      res.status,
      payload?._server_messages ? JSON.parse(payload._server_messages) : []
    );
  }

  // Frappe wraps whitelisted method returns under `message`.
  return (payload.message ?? payload) as Envelope<T, M>;
}

async function uploadFile(file: File, attachTo: { doctype: string; docname: string }): Promise<{ file_url: string; file_name: string }> {
  const csrfToken = getCookie("csrf_token");
  const form = new FormData();
  form.append("file", file);
  form.append("doctype", attachTo.doctype);
  form.append("docname", attachTo.docname);
  form.append("is_private", "0");

  const res = await fetch("/backend-api/method/upload_file", {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : undefined,
    body: form,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FrappeApiError(payload?.exception || res.statusText, res.status);
  }
  return payload.message;
}

export const frappe = {
  get: <T, M = Record<string, unknown>>(method: string, query?: Record<string, unknown>) =>
    request<T, M>(method, { query, httpMethod: "GET" }),
  post: <T, M = Record<string, unknown>>(method: string, body?: Record<string, unknown>) =>
    request<T, M>(method, { body, httpMethod: "POST" }),
  put: <T, M = Record<string, unknown>>(method: string, body?: Record<string, unknown>) =>
    request<T, M>(method, { body, httpMethod: "PUT" }),
  uploadFile,
};

export interface PaginatedMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
