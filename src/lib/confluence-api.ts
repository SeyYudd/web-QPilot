import type { CaptureStatus, ComparisonResult } from "../types";
import type { JiraClient } from "./jira-api";

export interface ConfluencePage { title?: string; version?: { number?: number }; body?: { storage?: { value?: string } }; }

const imageSelector = "ac\\:image, ri\\:attachment, img";
const jiraKeyPattern = /[A-Z][A-Z0-9]+-\d+/i;

export function macroTitle(node: Element) {
  return node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent?.trim() || "";
}

export function macroKey(node: Element) {
  const source = `${macroTitle(node)} ${node.textContent || ""} ${node.getAttribute("data-key") || ""}`;
  return source.match(jiraKeyPattern)?.[0]?.toUpperCase() || "";
}

function isTestCaseTable(table: Element) {
  const labels = [...table.querySelectorAll("tr")].map((row) =>
    row.querySelector("td,th")?.textContent?.trim() || "",
  );
  return labels.some((label) => /no\.?\s*test\s*case/i.test(label)) && labels.some((label) => /^key$/i.test(label));
}

export function tableKey(table: Element) {
  const keyRow = [...table.querySelectorAll("tr")].find((row) => /^key$/i.test(row.querySelector("td,th")?.textContent?.trim() || ""));
  if (!keyRow) return "";
  const cell = keyRow.querySelectorAll("td,th")[1];
  return (cell?.textContent || "").match(jiraKeyPattern)?.[0]?.toUpperCase() || "";
}

function scenarioTitle(table: Element) {
  const row = [...table.querySelectorAll("tr")].find((item) => /^scenario$/i.test(item.querySelector("td,th")?.textContent?.trim() || ""));
  return row?.querySelectorAll("td,th")[1]?.textContent?.trim() || "-";
}

function captureDetails(table: Element) {
  const row = [...table.querySelectorAll("tr")].find((item) => /screen\s*capture/i.test(item.querySelector("td,th")?.textContent || ""));
  if (!row) return { status: "Empty", count: 0 };
  const cell = row.querySelectorAll("td,th")[1] || row;
  const expands = [...cell.querySelectorAll("ac\\:structured-macro")].filter((node) => (node.getAttribute("ac:name") || "").toLowerCase() === "expand");
  const targets = expands.length ? expands : [cell];
  const statuses = targets.map((target, index) => {
    const images = [...target.querySelectorAll(imageSelector)].filter((element) => element.tagName.toLowerCase() !== "img" || !/(?:icon|avatar|emoji|attachment-indicator)/i.test(`${element.className || ""} ${element.getAttribute("alt") || ""} ${element.getAttribute("title") || ""}`));
    const text = (target.textContent || "").replace(/screen capture/ig, "").replace(/>/g, "").replace(/\s+/g, " ").trim();
    return `${index + 1}. ${images.length ? "Has Image" : text.length > 10 ? "Text Only" : "Empty"}`;
  });
  return { status: statuses.join("\n"), count: statuses.length };
}

export function testCaseMacros(doc: Document) {
  return [...doc.querySelectorAll("table")].filter(isTestCaseTable).filter((table) => Boolean(tableKey(table)));
}

export function captureStatus(html: string, key: string): CaptureStatus {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const normalizedKey = key.toUpperCase();
  const macro = testCaseMacros(doc).find((node) => tableKey(node) === normalizedKey);
  return macro ? captureDetails(macro).status : "Empty";
}

export function confluenceKeys(html: string) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return [...new Set(testCaseMacros(doc).map(tableKey).filter(Boolean))];
}

// Menerima page ID mentah atau URL halaman Confluence, mengembalikan page ID numerik.
export function extractPageId(input: string) {
  const value = String(input || "").trim();
  if (/^\d+$/.test(value)) return value;
  const fromQuery = value.match(/[?&]pageId=(\d+)/i)?.[1];
  if (fromQuery) return fromQuery;
  const fromPath = value.match(/\/pages\/(\d+)(?:[/?#]|$)/i)?.[1];
  if (fromPath) return fromPath;
  return "";
}

export async function getPage(client: JiraClient, baseUrl: string, pageId: string) {
  try {
    return await client.request<ConfluencePage>(`${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version`);
  } catch (error) {
    if (String(error instanceof Error ? error.message : error).includes("HTTP 404")) throw new Error(`Halaman Confluence dengan Page ID ${pageId} tidak ditemukan (HTTP 404). Periksa kembali Page ID — contoh angka seperti 6597588, bukan tanggal atau judul halaman.`, { cause: error });
    throw error;
  }
}

function serializeStorage(doc: Document) {
  return doc.body.innerHTML.replace(/<\s*(br|hr|img|input|meta|link|col|source)(\s[^>]*)?>/gi, (tag, name, attrs = "") => /\/\s*>$/.test(tag) ? tag : `<${name}${attrs} />`).replace(/<\/br\s*>/gi, "");
}

export async function updateConfluence(client: JiraClient, baseUrl: string, pageId: string, mutate: (doc: Document) => boolean | void) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const page = await getPage(client, baseUrl, pageId);
    const doc = new DOMParser().parseFromString(page.body?.storage?.value || "", "text/html");
    if (mutate(doc) === false) return false;
    try {
      await client.request(`${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "page", title: page.title, version: { number: (page.version?.number || 1) + 1 }, body: { storage: { value: serializeStorage(doc), representation: "storage" } } }) });
      return true;
    } catch (error) {
      if (!String(error instanceof Error ? error.message : error).includes("HTTP 409") || attempt === 3) throw error;
    }
  }
  return false;
}

export function fixPositionMutation(order: string[]) {
  return (doc: Document) => {
    const macros = testCaseMacros(doc);
    if (!macros.length) return false;
    // Unit yang dipindah: macro expand utuh untuk mode "expand", <table> langsung untuk "without expand".
    const units = macros.map((table) => table.closest("ac\\:structured-macro") || table);
    // Rank global mengikuti urutan Jira; key yang tidak ada di order didorong ke bawah (stable).
    const rank = new Map(order.map((key, index) => [key.toUpperCase(), index]));
    const containers = new Map<Element, Element[]>();
    units.forEach((unit) => {
      const container = unit.parentElement?.closest("ac\\:layout-cell") || unit.parentElement || doc.body;
      const list = containers.get(container) || [];
      if (!list.includes(unit)) list.push(unit);
      containers.set(container, list);
    });
    // Reorder SEMUA container (bukan hanya yang terbanyak) agar urutan seluruh halaman mengikuti Jira.
    containers.forEach((scopedUnits, container) => {
      const sorted = scopedUnits
        .map((unit, index) => {
          const table = unit.tagName.toLowerCase() === "table" ? unit : unit.querySelector("table") || unit;
          const key = tableKey(table);
          return { unit, index, keyRank: key ? rank.get(key) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER };
        })
        .sort((a, b) => a.keyRank - b.keyRank || a.index - b.index);
      sorted.forEach(({ unit }) => container.appendChild(unit));
    });
    return true;
  };
}

export function compareRows(jiraKeys: string[], html: string, statuses: Map<string, ComparisonResult["teStatus"]>) {
  const keys = confluenceKeys(html);
  const extra = keys.filter((key) => !jiraKeys.includes(key));
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const tables = testCaseMacros(doc);
  const titles = new Map(tables.map((table) => [tableKey(table), scenarioTitle(table)]));
  const modes = new Map<string, "expand" | "table">(tables.map((table) => [tableKey(table), table.closest("ac\\:structured-macro") ? "expand" : "table"]));
  const captureCounts = new Map(tables.map((table) => [tableKey(table), captureDetails(table).count]));
  const rows: ComparisonResult[] = jiraKeys.map((key, index) => { const position = keys.indexOf(key); return { key, order: index + 1, position, positionTitle: position < 0 ? "-" : titles.get(key) || "-", displayMode: modes.get(key) || "missing", capture: captureStatus(html, key), captureCount: captureCounts.get(key) || 0, status: position < 0 ? "Missing di Confluence" : position === index ? "Match" : "Urutan berbeda", teStatus: statuses.get(key) || "TODO" }; });
  extra.forEach((key) => rows.push({ key, order: "-", position: keys.indexOf(key), positionTitle: titles.get(key) || "-", displayMode: modes.get(key) || "missing", capture: captureStatus(html, key), captureCount: captureCounts.get(key) || 0, status: "Extra di Confluence", teStatus: statuses.get(key) || "-" }));
  return rows;
}
