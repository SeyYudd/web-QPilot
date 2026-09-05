// lib/auth/validation.ts — Step 2: Silent Background Validation. Memvalidasi
// PAT Jira & Confluence secara simultan, lalu mementukan outcome sesuai spec:
//   bothValidAndPnMatch / tokenExpiredOrInvalid / pnMismatch / network / invalid.

import {
  loadSession,
  touchLastValidated,
  clearSession,
  isAuthErrorKind,
} from "./session";
import type { AuthSession } from "./session";
import { fetchJiraCurrentUser } from "../api/jira";
import { fetchConfluenceCurrentUser } from "../api/confluence";

export type ValidationOutcome =
  | { outcome: "authenticated"; jiraPn: string; confluencePn: string }
  | { outcome: "pnMismatch"; jiraPn: string; confluencePn: string }
  | { outcome: "expired" } // 401 Jira atau Confluence
  | { outcome: "network"; detail: string }
  | { outcome: "cors"; detail: string } // browser diblokir lintas-origin oleh server
  | { outcome: "invalid"; detail: string };

/**
 * Validasi simultan kedua token. Selalu melempar hasil ke caller via Promise
 * (tidak throw), sehingga UI dapat menampilkan state tanpa crash.
 */
export async function validateSession(session: AuthSession): Promise<ValidationOutcome> {
  const [jiraRes, confRes] = await Promise.allSettled([
    fetchJiraCurrentUser(session),
    fetchConfluenceCurrentUser(session),
  ]);

  const jiraExpired = jiraRes.status === "rejected" && isAuthErrorKind(jiraRes.reason, "TOKEN_EXPIRED");
  const confExpired = confRes.status === "rejected" && isAuthErrorKind(confRes.reason, "TOKEN_EXPIRED");

  // tokenExpiredOrInvalid: 401 pada salah satu modul → evict session.
  if (jiraExpired || confExpired) {
    clearSession();
    return { outcome: "expired" };
  }

  const jiraPn = jiraRes.status === "fulfilled" ? jiraRes.value.pn : null;
  const confPn = confRes.status === "fulfilled" ? confRes.value.pn : null;

  // Keduanya valid → cek kecocokan PN.
  if (jiraPn && confPn) {
    if (jiraPn === confPn) {
      touchLastValidated(session);
      return { outcome: "authenticated", jiraPn, confluencePn: confPn };
    }
    return { outcome: "pnMismatch", jiraPn, confluencePn: confPn };
  }

  // Server reachable tapi browser memblokir akses lintas-origin (CORS,: lebih
  // actionable dan beda penanganan dari offline, jadi diprioritaskan dulu.
  const jiraCors = jiraRes.status === "rejected" && isAuthErrorKind(jiraRes.reason, "CORS_BLOCKED");
  const confCors = confRes.status === "rejected" && isAuthErrorKind(confRes.reason, "CORS_BLOCKED");
  if (jiraCors || confCors) {
    const detail = [jiraRes.status === "rejected" ? jiraRes.reason : null, confRes.status === "rejected" ? confRes.reason : null]
      .filter(Boolean)
      .map((err) => String((err as Error).message || err))
      .join(" ");
    return { outcome: "cors", detail };
  }
 

  // Salah satu gagal karena jaringan internal / VPN terputus.

  const jiraOffline = jiraRes.status === "rejected" && isAuthErrorKind(jiraRes.reason, "NETWORK_OFFLINE");
  const confOffline = confRes.status === "rejected" && isAuthErrorKind(confRes.reason, "NETWORK_OFFLINE");
  if (jiraOffline || confOffline) {
    const detail = [
      jiraRes.status === "rejected" ? jiraRes.reason : null,
      confRes.status === "rejected" ? confRes.reason : null,
    ]
      .filter(Boolean)
      .map((err) => String((err as Error).message || err))
      .join(" ");
    return { outcome: "network", detail };
  }

  // Lainnya (403/404/500/format tak terduga) → invalid.
  const detail = [jiraRes.status === "rejected" ? jiraRes.reason : null, confRes.status === "rejected" ? confRes.reason : null]
    .filter(Boolean)
    .map((err) => String((err as Error).message || err))
    .join(" ");
  return { outcome: "invalid", detail };
}

/** Variant dari validateSession yang membaca session dari localStorage langsung. */
export async function validateStoredSession(): Promise<ValidationOutcome> {
  const session = loadSession();
  if (!session) return { outcome: "expired" };
  return validateSession(session);
}