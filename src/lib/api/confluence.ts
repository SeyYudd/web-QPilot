// lib/api/confluence.ts — Modul API Confluence (isolasi error per-file, lihat
// claude.md dan spec on401Interceptor). 401 → clearSession + TOKEN_EXPIRED ke UI.

import {
  apiFetch,
  clearSession,
  loadSession,
  AuthError,
  CONFLUENCE_CURRENT_USER_ENDPOINT,
} from "../auth/session";
import type { AuthSession } from "../auth/session";

/** Validasi PAT Confluence (Step 2): GET /rest/api/user/current → username (PN) + profil akun. */
export async function fetchConfluenceCurrentUser(session: AuthSession): Promise<{ pn: string; username: string; displayName: string; emailAddress: string }> {
  const response = await apiFetch(
    CONFLUENCE_CURRENT_USER_ENDPOINT,
    { method: "GET" },
    session.confluencePat,
  );
  if (response.status === 401) {
    clearSession();
    throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} pada validasi Confluence`);
  const body = (await response.json().catch(() => ({}))) as {
    username?: unknown;
    displayName?: unknown;
    email?: unknown;
    emailAddress?: unknown;
  };
  const pn = String(body.username || "").trim();
  if (!pn) throw new Error("PN Confluence tidak ditemukan pada response current user.");
  return {
    pn,
    username: pn,
    displayName: String(body.displayName || "").trim(),
    emailAddress: String(body.email || body.emailAddress || "").trim(),
  };
}

/**
 * Client Confluence Bearer dengan perilaku yang sama seperti Jira (401 →
 * clearSession + TOKEN_EXPIRED). Kontrak request<T>(url, options) agar
 * compatibel dengan pemanggilan GET/PUT halaman Confluence.
 */
export interface ConfluenceClient {
  request<T>(url: string, options?: RequestInit): Promise<T>;
}

/** Parse JSON response dengan aman: 204 atau body kosong → objek kosong. */
async function safeParseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;
  let text: string;
  try { text = await response.text(); } catch { return {} as T; }
  if (!text || !text.trim()) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

export function createConfluenceClient(_baseUrl: string): ConfluenceClient {
  const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const session = loadSession();
    if (!session) throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
    // Confluence Data Center: tambahkan header AJAX standar pada mutasi agar
    // Confluence mengakui ini request AJAX sah (bukan form submit HTML) dan
    // bypass XSRF cookie check.
    const method = String(options.method || "GET").toUpperCase();
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined || {}) };
    if (method !== "GET") {
      headers["X-Atlassian-Token"] = "no-check";
      headers["X-Requested-With"] = "XMLHttpRequest";
    }
    const opts: RequestInit = { ...options, headers };
    const response = await apiFetch(url, opts, session.confluencePat);
    if (response.status === 401) {
      clearSession();
      throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
    }
    if (!response.ok) {
      let detail = "";
      let raw: unknown;
      try { raw = await response.json(); } catch { /* non JSON */ }
      console.error("[Confluence API] Rejected", { url: response.url, status: response.status, statusText: response.statusText, body: raw });
      if (raw && typeof raw === "object") {
        const value = raw as { message?: unknown; errorMessages?: unknown; errors?: Record<string, unknown> };
        const messages = Array.isArray(value.errorMessages) ? value.errorMessages.join(" ") : "";
        const fields = value.errors ? Object.entries(value.errors).map(([k, v]) => `${k}: ${String(v)}`).join("; ") : "";
        detail = String(value.message || messages || fields || "");
      }
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return await safeParseJson<T>(response);
  };
  return { request };
}