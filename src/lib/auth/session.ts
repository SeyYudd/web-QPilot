// QPilot PAT Auth & Session Management — storage & auth primitives.
// Flow per docs: Step 1 (check localStorage) → Step 2 (silent background
// validation) → Step 3 (runtime 401 auto-eviction di setiap file API).
// Skema session mengikuti spec "qpilot/auth-session-spec".

export const SESSION_STORAGE_KEY = "qpilot_auth_session";

export const JIRA_BASE_URL = "https://jira.bri.co.id";
export const CONFLUENCE_BASE_URL = "https://confluence.bri.co.id";

// Prefix path proxy Vite (sama-origin). Dipakai untuk menulis ulang host absolut
// BRI menjadi path proxu agar tidak terblokir CORS oleh browser.
export const JIRA_PROXY_PREFIX = "/api/jira-proxy";
export const CONFLUENCE_PROXY_PREFIX = "/api/confluence-proxy";

// Endpoint validasi yang dipakai pada Step 2 (Silent Background Validation).
export const JIRA_MYSELF_ENDPOINT = "/api/jira-proxy/rest/api/2/myself";
export const CONFLUENCE_CURRENT_USER_ENDPOINT = "/api/confluence-proxy/rest/api/user/current";

export interface AuthSession {
  pn: string; // Contoh: '00123456'
  displayName: string;
  jiraPat: string;
  confluencePat: string;
  lastValidated: string; // ISO Date
}

export type AuthErrorKind =
  | "NETWORK_OFFLINE" // VPN/internal BRI terputus
  | "CORS_BLOCKED" // origin aplikasi tidak di-allowlist oleh server Jira/Confluence
  | "TOKEN_EXPIRED" // PAT expired / di-revoke
  | "SESSION_CORRUPTED"; // JSON di localStorage tidak valid

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  constructor(kind: AuthErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthError";
    this.kind = kind;
  }
}

export function isAuthErrorKind(error: unknown, kind: AuthErrorKind): boolean {
  return error instanceof AuthError && error.kind === kind;
}

/**
 * Step 1: Ambil session 'qpilot_auth_session' dari localStorage.

 * Format yang tidak valid (SESSION_CORRUPTED) diperlakukan sama seperti tidak
 * ada — langkah selanjutnya adalah Form Setup PAT (UNAUTHENTICATED).
 */
export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.pn === "string" &&
      typeof parsed.displayName === "string" &&
      typeof parsed.jiraPat === "string" &&
      typeof parsed.confluencePat === "string" &&
      typeof parsed.lastValidated === "string"
    )
      return parsed as AuthSession;
    return null;
  } catch {
    // SESSION_CORRUPTED — treat as unauthenticated (Step 1 notFound path)。
    return null;
  }
}

export function hasSession(): boolean {
  return loadSession() !== null;
}

export function saveSession(session: AuthSession): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/** Hapus 'qpilot_auth_session' dari localStorage → state UI menjadi UNAUTHENTICATED. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** Update lastValidated (ISO date) di localStorage tanpa menggubah token/PAT. */
export function touchLastValidated(session: AuthSession): void {
  const updated: AuthSession = { ...session, lastValidated: new Date().toISOString() };
  saveSession(updated);
}

/**
 * Baca base URL dari chrome.storage bila tersedia (mode extension); kembalikan
 * undefined bila dijalankan sebagai web app biasa atau data belum dikonfigurasi.
 */
async function getStoredBaseUrl(key: string): Promise<string | undefined> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = await chrome.storage.local.get([key]);
      const value = (stored as Record<string, unknown>)?.[key];
      if (typeof value === "string" && value.trim()) return value.trim().replace(/\/$/, "");
    }
  } catch { /* non-extension / chrome storage tidak tersedia */ }
  return undefined;
}

/** Base URL Jira: config extension bila ada, fallback ke host default (diproxy oleh apiFetch). */
export async function getJiraBaseUrl(): Promise<string> {
  return (await getStoredBaseUrl("jiraUrl")) || JIRA_BASE_URL;
}

/** Base URL Confluence: config extension bila ada, fallback ke host default (diproxy oleh apiFetch). */
export async function getConfluenceBaseUrl(): Promise<string> {
  return (await getStoredBaseUrl("confUrl")) || CONFLUENCE_BASE_URL;
}

/**
 * Request ber-Authorization yang otomatis memilih PAT yang sesuai (Jira vs
 * Confluence) berdasar target URL, dan memakai alur proxy via apiFetch. Dipakai
 * oleh requestApi / jiraImport sebagai fallback saat window.qpilotApiFetch
 * (client extension) tidak tersedia — sehingga fitur jalan di web app biasa.
 */
export async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const session = loadSession();
  if (!session) throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  const isConfluence =
    url.startsWith(CONFLUENCE_BASE_URL) || /\/api\/confluence-proxy\//.test(url);
  return apiFetch(url, options, isConfluence ? session.confluencePat : session.jiraPat);
}

/**
 * apiFetch: panggilan fetch ke network internal BRI dengan header Authorization Bearer.
 * Bila fetch gagal, klasifikasi via classifyNetworkFailure: server reachable tapi
 * browser memblokir lintas-origin (CORS, => CORS_BLOCKED; server unreachable =>.
 * NETWORK_OFFLINE. HTTP 401 / TOKEN_EXPIRED ditangani per-file API (Step 3).
 */

/**
 * Tulis ulang host absolut BRI menjadi path proxy (sama-origin) sehingga request
 * tidak terblokir CORS. URL yang sudah relatif (/api/...) atau host non-BRI
 * dibiarkan apa adanya.
 */
export function toProxyUrl(url: string): string {
  if (url.startsWith(JIRA_BASE_URL)) return `${JIRA_PROXY_PREFIX}${url.slice(JIRA_BASE_URL.length)}`;
  if (url.startsWith(CONFLUENCE_BASE_URL)) return `${CONFLUENCE_PROXY_PREFIX}${url.slice(CONFLUENCE_BASE_URL.length)}`;
  return url;
}

/** Pisahkan CORS-block dari jaringan putus: GET probe `no-cors`. */
async function classifyNetworkFailure(url: string, cause: unknown): Promise<never> {
  let reachable = false;
  try {
    await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" });
    reachable = true;
  } catch { /* jaringan putus: probe gagal */ }

  if (reachable) {
    throw new AuthError(
      "CORS_BLOCKED",
      "Jaringan internal BRI terhubung, tetapi browser memblokir akses lintas-origin ke " +
        "server Jira/Confluence: origin aplikasi ini belum di-allowlist di server, sehingga " +
        "akses dari origin ini ditolak. Hubungi admin BRI / gunakan proxy atau extension.",
      { cause },
    );
  }
  throw new AuthError(
    "NETWORK_OFFLINE",
    "Gagal terhubung ke jaringan internal BRI. Periksa koneksi/VPN anda lalu coba lagi.",
    { cause },
  );
}

export async function apiFetch(url: string, options: RequestInit = {}, pat: string): Promise<Response> {
  const target = toProxyUrl(url);
  const method = String(options.method || "GET").toUpperCase();
  // XSRF guard: meneruskan `no-check` pada mutasi. Untuk auth PAT header ini
  // umumnya tidak wajib (berlaku utk form/HTMl berbasis cookie), tapi tidak
  // berbahaya dan diminta — sekaligus konsisten lewat satu choke point.
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${pat}`,
  };
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    headers["X-Atlassian-Token"] = "no-check";
  }
      // Confluence Data Center mewajibkan header AJAX standar pada mutasi.
  // Tambahkan X-Requested-With: XMLHttpRequest agar Confluence mengakui ini
  // request AJAX yang sah (bukan submit form HTML), serta no-check untuk bypass XSRF.
  if (target.includes("/confluence-proxy/") && method !== "GET") {
    headers["X-Atlassian-Token"] = "no-check";
    headers["X-Requested-With"] = "XMLHttpRequest";
  }
  try {
    // credentials:'omit' memaksa browser tidak menyertakan cookie session (JSESSIONID,
  // atlassian.xsrf.token) supaya request Jira/Confluence murni stateless Bearer
  // — persis seperti cURL yang terbukti lolos.
  return await fetch(target, { ...options, headers, credentials: "omit" });
  } catch (error) {
    // classifyNetworkFailure selalu reject dengan AuthError CORS/NETWORK,
    // jadi baris di bawah ini tidak pernah tercapai (penutup buat TS flow).
    await classifyNetworkFailure(target, error);
    throw error;
  }
}