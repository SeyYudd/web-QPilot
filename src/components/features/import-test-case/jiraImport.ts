import { addTestToExecution, linkIssues } from "@/lib/jira-api";
import { authorizedFetch } from "@/lib/auth/session";
import { dash, text, type Row } from "./types";

export async function api<T = unknown>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const init: RequestInit = { headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) }, credentials: "omit", ...options };
  // Prioritas client extension; fallback ke alur proxy apiFetch untuk web app.
  const response = window.qpilotApiFetch
    ? await window.qpilotApiFetch(`${base}${path}`, init)
    : await authorizedFetch(`${base}${path}`, init);
  if (!response.ok) {
    let detail = "";
    let raw: unknown;
    try { raw = await response.json(); } catch { /* non JSON */ }
    console.error("[Jira Import] Rejected", { url: `${base}${path}`, status: response.status, statusText: response.statusText, body: raw });
    if (raw && typeof raw === "object") {
      const value = raw as { errorMessages?: unknown; errors?: Record<string, unknown>; message?: unknown };
      const messages = Array.isArray(value.errorMessages) ? value.errorMessages.join(" ") : "";
      const fields = value.errors ? Object.entries(value.errors).map(([k, v]) => `${k}: ${String(v)}`).join("; ") : "";
      detail = String(messages || fields || value.message || "");
    }
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
    return await safeParseJson<T>(response);
}

/** Parse Jira API response safely: 204 or empty body → {}, never throws. */
async function safeParseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;
  let text: string;
  try { text = await response.text(); } catch { return {} as T; }
  if (!text || !text.trim()) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

export function findFolder(data: unknown, path: string): string | number | undefined {
  const decoded = decodeURIComponent(path);
  const parts = decoded.split(/[\\/]/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  const flatten = (nodes: unknown[]): unknown[] => nodes.flatMap((node) => { const n = node as Record<string, unknown>; return [n, ...(Array.isArray(n?.folders) ? flatten(n.folders as unknown[]) : Array.isArray(n?.subfolders) ? flatten(n.subfolders as unknown[]) : [])]; });
  const all = flatten(Array.isArray(data) ? data : (data as Record<string, unknown>)?.folders as unknown[] || [data]);
  const byName = (name: string) => (node: unknown) => String((node as Record<string, unknown>)?.name || "").trim().toLowerCase() === name.toLowerCase();
  let level = all;
  let found: Record<string, unknown> | undefined;
  for (const part of parts) {
    found = level.find(byName(part)) as Record<string, unknown> | undefined;
    if (!found) break;
    level = flatten([found]).filter((node) => node !== found);
  }
  if (found) return found.id as string | number;
  const exact = all.find((node) => String((node as Record<string, unknown>)?.path || "").trim().toLowerCase() === decoded.trim().toLowerCase()) as Record<string, unknown> | undefined;
  if (exact) return exact.id as string | number;
  const last = all.find(byName(parts[parts.length - 1])) as Record<string, unknown> | undefined;
  return last?.id as string | number | undefined;
}

// Eksekusi satu baris import: create/link Test di Jira Xray, daftarkan ke
// Test Repository folder, lalu tambahkan ke Test Execution bila diisi.
export async function processRow(row: Row, base: string): Promise<Partial<Row>> {
  const started = Date.now();
  const duration = () => `${Math.max(1, Math.round((Date.now() - started) / 1000))}s`;
  let key = row.jiraExist;
  const hasSteps = row.steps.some((step) => step.action || step.data || step.expectedResult);
  // Xray Server: Test Type = Manual harus di-set agar field Manual Steps (customfield_11404) aktif.
  // customfield_11400 = Test Type (value id 10801 = Manual), customfield_11404 = Manual Steps.
  // Struktur asli Jira (hasil GET TROC-9): tiap step punya index + fields dengan key kapital "Action", "Data", "Expected Result".
  const steps = row.steps.filter((step) => step.action || step.data || step.expectedResult).map((step, i) => ({ index: i + 1, fields: { Action: dash(step.action), Data: dash(step.data), "Expected Result": dash(step.expectedResult) } }));
  let degraded = "";
  const sent: string[] = [];
  try {
    if (!row.reuse) {
      const baseFields: Record<string, unknown> = { project: { key: row.project }, summary: row.summary, issuetype: { name: "Test" }, customfield_11400: { id: "10801" } };
      const fullFields: Record<string, unknown> = { ...baseFields, assignee: { name: row.assignee }, labels: row.labels.split(",").map(text).filter(Boolean) };
      if (hasSteps) fullFields.customfield_11404 = { steps };
      if (row.description.trim()) fullFields.description = row.description;
      let created: { key?: string };
      try { created = await api(base, "/rest/api/2/issue", { method: "POST", body: JSON.stringify({ fields: fullFields }) }); sent.push(JSON.stringify({ fields: fullFields }, null, 2)); }
      catch {
        try { const noSteps = { ...fullFields }; delete noSteps.customfield_11404; created = await api(base, "/rest/api/2/issue", { method: "POST", body: JSON.stringify({ fields: noSteps }) }); degraded = "Steps ditolak Jira"; sent.push(JSON.stringify({ fields: noSteps }, null, 2)); }
        catch { created = await api(base, "/rest/api/2/issue", { method: "POST", body: JSON.stringify({ fields: baseFields }) }); degraded = "Assignee/Labels/Description ditolak Jira"; sent.push(JSON.stringify({ fields: baseFields }, null, 2)); }
      }
      key = created.key || "";
    }
    const client = { request: (url: string, options?: RequestInit) => api(base, url.replace(base, ""), options) as never };
    const folder = await api(base, `/rest/raven/1.0/api/testrepository/${encodeURIComponent(row.project)}/folders`);
    const folderId = findFolder(folder, row.repository);
    if (!folderId) throw new Error(`Folder repository tidak ditemukan: ${row.repository}`);
    await api(base, `/rest/raven/1.0/api/testrepository/${encodeURIComponent(row.project)}/folders/${encodeURIComponent(String(folderId))}/tests`, { method: "PUT", body: JSON.stringify({ add: [key] }) });
    const notes: string[] = degraded ? [degraded] : [];
    // Penjamin: bila steps tidak masuk saat create (degraded), coba set Manual Steps via update.
    if (!row.reuse && hasSteps && degraded) {
      try { await api(base, `/rest/api/2/issue/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ fields: { customfield_11404: { steps } } }) }); notes.push("Steps diisi ulang via update"); }
      catch { notes.push("Steps tetap gagal disimpan"); }
    }
    try { await api(base, `/rest/api/2/issue/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ fields: { priority: { name: "Medium Effort - Medium Value" } } }) }); } catch { notes.push("Priority tidak tersedia"); }
    if (row.issueLinks.trim()) { for (const target of row.issueLinks.split(",").map(text).filter(Boolean)) { try { await linkIssues(client, base, "Relates", key, target); } catch { notes.push(`relates to ${target} gagal`); } } }
    if (row.testExecution) { await addTestToExecution(client, base, row.testExecution, key); }
    return { result: row.reuse ? "linked" : "created", jiraKey: key, detail: notes.length ? notes.join(" | ") : "", payload: sent.join("\n\n--- payload fallback berikutnya ---\n\n"), duration: duration() };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gagal diproses.";
    const m = msg.match(/HTTP (\d+)/);
    return { result: "failed", statusCode: m ? Number(m[1]) : undefined, jiraKey: key, detail: degraded ? `${msg} (degraded: ${degraded})` : msg, payload: sent.join("\n\n--- payload fallback berikutnya ---\n\n"), duration: duration() };
  }
}

