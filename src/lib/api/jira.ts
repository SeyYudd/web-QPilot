// lib/api/jira.ts — Modul API Jira (isolasi error per-file, lihat claude.md dan
// spec on401Interceptor). Step 3: jika API mengembalikan 401, modul ini
// memanggil clearSession() lalu melempar TOKEN_EXPIRED ke UI tanpa crash.



import {
  apiFetch,
  clearSession,
  loadSession,
  AuthError,
  JIRA_MYSELF_ENDPOINT,
} from "../auth/session";
import type { AuthSession } from "../auth/session";
import type { JiraClient } from "../jira-api";

function requireSession(): AuthSession {
  const session = loadSession();
  if (!session) {
    throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  }
  return session;
}

function parseErrorDetail(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const value = body as {
    errorMessages?: unknown;
    errors?: Record<string, unknown>;
    message?: unknown;
    error?: unknown;
  };
  const messages = Array.isArray(value.errorMessages) ? value.errorMessages.join(" ") : "";
  const fields = value.errors ? Object.entries(value.errors).map(([k, v]) => `${k}: ${String(v)}`).join("; ") : "";
  return String(messages || fields || value.message || value.error || "").trim();
}

/** Cetak detail reject/error Jira ke console agar field yang kurang terlihat jelas. */
function logRejected(response: Response, body: unknown): void {
  console.error("[Jira API] Rejected", {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    body,
  });
}

async function parseBody<T>(response: Response): Promise<T> {
  return safeParseJson<T>(response);
}

/** Parse JSON response dengan aman: 204 atau body kosong → objek kosong, tidak crash. */
async function safeParseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;
  let text: string;
  try { text = await response.text(); } catch { return {} as T; }
  if (!text || !text.trim()) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

async function assertOk(response: Response, url: string): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) {
    // Auto-eviction: token expired / di-revoke. Hapus session dan lempar error.

    clearSession();
    throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  }
  let detail = "";
  const raw = await safeParseJson<unknown>(response.clone());
  if (raw && typeof raw === "object") {
    logRejected(response, raw);
    detail = parseErrorDetail(raw);
  } else {
    logRejected(response, await response.text().catch(() => ""));
  }
  throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`, { cause: url });
}

/** Validasi PAT Jira (Step 2)and: GET /rest/api/2/myself → PN Jira. */
export async function fetchJiraCurrentUser(session: AuthSession): Promise<{ pn: string }> {
  const response = await apiFetch(JIRA_MYSELF_ENDPOINT, { method: "GET" }, session.jiraPat);
  if (response.status === 401) {
    clearSession();
    throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} pada validasi Jira`);
  const body = await parseBody<{ name?: unknown; key?: unknown }>(response);
  const pn = String(body.name || body.key || "").trim();
  if (!pn) throw new Error("PN Jira tidak ditemukan pada response myself.");
  return { pn };
}

/**
 * Membuat Jira client Bearer (401 → clearSession + TOKEN_EXPIRED). Mempertahankan
 * kontrak lama createJiraClient(baseUrl) → { request<T>(url, options)) } sehingga
 * seluruh pemanggil business-logic (useCompareLogic, JiraTeView, Dashboard,
 * jiraImport) tetap berfungsi tanpa perubahan.  */


export function createJiraClient(_baseUrl: string): JiraClient {
 
  const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const session = requireSession();
    const response = await apiFetch(url, options, session.jiraPat);
    await assertOk(response, url);
    return await parseBody<T>(response);
  };
  return { request };
}