import { authorizedFetch } from "@/lib/auth/session";

export const fieldClass =
  "mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export type StepRow = { action: string; data: string; expectedResult: string };
export type TestCase = {
  no: number;
  scenario: string;
  function: string;
  steps: string;
  data: string;
  expectedResult: string;
  stepRows?: StepRow[];
  key: string;
  summary?: string;
};
export type DraftFields = Pick<
  TestCase,
  "key" | "scenario" | "function" | "steps" | "data" | "expectedResult"
>;
export type Draft = DraftFields & { stepRows: StepRow[] };

export async function requestApi(url: string, options: RequestInit = {}) {
  const init: RequestInit = {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    credentials: "omit",
    ...options,
  };
  // Prioritas client extension (window.qpilotApiFetch); fallback ke alur proxy
  // apiFetch supaya fitur tetap jalan ketika app dibuka sebagai web app biasa.
  const response = window.qpilotApiFetch
    ? await window.qpilotApiFetch(url, init)
    : await authorizedFetch(url, init);
  if (!response.ok) {
    let detail = "";
    let raw: unknown;
    try { raw = await response.json(); } catch { /* non JSON */ }
    console.error("[Request API] Rejected", { url, status: response.status, statusText: response.statusText, body: raw });
    if (raw && typeof raw === "object") {
      const value = raw as { errorMessages?: unknown; errors?: Record<string, unknown>; message?: unknown };
      const messages = Array.isArray(value.errorMessages) ? value.errorMessages.join(" ") : "";
      const fields = value.errors ? Object.entries(value.errors).map(([k, v]) => `${k}: ${String(v)}`).join("; ") : "";
      detail = String(messages || fields || value.message || "");
    }
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.status === 204 ? {} : response.json();
}

declare global {
  interface Window {
    XLSX?: typeof import("xlsx");
    qpilotBlobStore?: { put(blob: Blob): Promise<string> };
    qpilotApiFetch?(url: string, options?: RequestInit): Promise<Response>;
  }
}
