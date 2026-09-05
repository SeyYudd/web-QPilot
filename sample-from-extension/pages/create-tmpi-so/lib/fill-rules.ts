// lib/fill-rules.ts — Dispatch fill rule per jenis placeholder
// (srs-automation-tmp.md 7.3): link, jira-macro, copy-content, table-fill, manual.
// Murni fungsi; sumber eksternal (fetch body Confluence) diinjeksi via ctx.
import type { NodeKey, TmpIsoProjectConfig } from "./types";

export type FillContext = {
  config: TmpIsoProjectConfig;
  /** Page yang baru dibuat pada run ini (untuk tag self-reference LINKTITLE...). */
  pages: Map<string, { id: string; title: string }>;
  /** Base URL Confluence untuk menyusun link ke page hasil generate. */
  confluenceBase: string;
  /** Fetch storage-format body page Confluence sumber (copy-content). */
  fetchPageBody: (pageRef: string) => Promise<string>;
};

export type FillOutcome = {
  body: string;
  /** Tag yang berhasil diganti. */
  filled: string[];
  /** Tag yang tidak bisa diganti karena open item (JQL Jira macro belum dikonfirmasi). */
  blocked: string[];
  /** Tag `{{...}}` di luar daftar 7.3 — dibiarkan mentah untuk diisi manual. */
  unknown: string[];
};

/** Tag link biasa → field config (tabel 7.3, tipe Link). */
export const LINK_TAGS: Record<string, keyof TmpIsoProjectConfig> = {
  "{{LINKJiraProject}}": "linkJiraProject",
  "{{LINKBRD}}": "linkBrd",
  "{{LINKSytemDesign}}": "linkSystemDesignDev",
  "{{LinkNCM}}": "linkNcm",
  "{{LINKJiraUQA}}": "linkJiraUqa",
  "{{LINKJiraDAST}}": "linkJiraDast",
  "{{LINKConfluenceDAST}}": "linkConfluenceDast",
  "{{LINKJIRASIT}}": "linkJiraSitTe",
  "{{LINKJIRAUAT}}": "linkJiraUatTe",
  "{{LINKCONFLUENCESOPDEPLOYMENT}}": "linkSopDeployment",
  "{{LINKCONFLUENCESOPDEPLOY}}": "linkSopDeployment",
  "{{LINKCONFLUENCESOPMAINTENANCE}}": "linkSopMaintenance",
  "{{LINKCONFLUENCESOPMONITORING}}": "linkSopMonitoring",
  "{{LINKCONFLUENCESOPTROUBLESHOOTING}}": "linkSopTroubleshooting",
  "{{LINKCONFLUENCESOPMIG}}": "linkMigDev",
};

/** Tag teks biasa (bukan link) → field config, di-XML-escape saat diisi. */
export const TEXT_TAGS: Record<string, keyof TmpIsoProjectConfig> = {
  "{{nama_fungsi}}": "namaFungsi",
  "{{nama_proyek}}": "namaProyek",
  "{{nama_aplikasi}}": "namaAplikasi",
  "{{nama_modul}}": "namaModul",
};

/** Tag self-reference ke page hasil generate pada run yang sama (7.2). */
export const LINKTITLE_TAGS: Record<string, NodeKey> = {
  "{{LINKTITLEConfluenceSIT}}": "01",
  "{{LINKConfluenceSIT}}": "01",
  "{{LINKTITLEConfluenceUAT}}": "02",
  "{{LINKTITLEConfluenceDeployment}}": "03",
};

/** Tag copy-content → field config sumber (URL/page id halaman Confluence). */
export const COPYCONTENT_TAGS: Record<string, keyof TmpIsoProjectConfig> = {
  "{{COPYCONTENTMIG}}": "linkMigDev",
  "{{COPYCONTENTSOPDEPLOYMENT}}": "linkSopDeployment",
  "{{COPYCONTENTSOPMAINTENANCE}}": "linkSopMaintenance",
  "{{COPYCONTENTSOPMONITORING}}": "linkSopMonitoring",
  "{{COPYCONTENTSOPTROUBLESHOOTING}}": "linkSopTroubleshooting",
};

// Jira Issues macro (Xray). JQL/filter ditebak dari key Test Execution (open item FR-7.4.8
// SUDAH SESUAI JANGAN DIUBAH 
const JIRAMACRO_STD_COLUMNS =
  "Key,Summary,T,Created,Updated,Due,Assignee,Reporter,P,Status,Resolution,Test Execution Status,Start date (WBSGantt),Finish date (WBSGantt)";

export type JiraMacroSpec = {
  teField: keyof TmpIsoProjectConfig;
  columns: string;
};

export const JIRA_MACRO_TAGS: Record<string, JiraMacroSpec> = {
  "{{LINKJIRAMACROUQA}}": { teField: "linkJiraUqa", columns: "key,summary,Assignee,Reporter,Status,Resolution" },
  "{{LINKJIRAMACROSITJIRATESTPLAN}}": { teField: "linkJiraSitTe", columns: JIRAMACRO_STD_COLUMNS },
  "{{LINKJIRAMACROUATJIRATESTPLAN}}": { teField: "linkJiraUatTe", columns: JIRAMACRO_STD_COLUMNS },
  // Deployment TE belum dikumpulkan — pakai UAT TE (guess, koreksi belakangan).
  "{{LINKJIRAMACRDEPLOYMENTJIRATESTPLAN}}": { teField: "linkJiraUatTe", columns: JIRAMACRO_STD_COLUMNS },
};

/** Ambil key Jira (mis. TE-123 / PROJ-2) dari teks atau URL. */
export function extractJiraKey(value: string): string {
  const m = String(value || "").match(/(?:^|\/|#)([A-Z][A-Z0-9]+-\d+)(?:$|\/|\?|#)/i);
  return m ? m[1].toUpperCase() : "";
}

/** Bangun storage-format macro Jira Issues (format sama seperti sample user). */
export function jiraMacroHtml(spec: JiraMacroSpec, teKey: string): string {
  const jql = `key in(${teKey})`;
  return (
    `<ac:structured-macro ac:name="jira" ac:schema-version="1">` +
    `<ac:parameter ac:name="jqlQuery">${escapeXml(jql)}</ac:parameter>` +
    `<ac:parameter ac:name="columns">${spec.columns}</ac:parameter>` +
    `<ac:parameter ac:name="maximumIssues">100</ac:parameter>` +
    `</ac:structured-macro>`
  );
}

/** Auto-link page (7.3): key node → tag di body page tersebut. */
export const AUTO_LINK_TAGS: Partial<Record<NodeKey, { tag: string; field: keyof TmpIsoProjectConfig }>> = {
  "1.1": { tag: "{{LINKJIRASIT}}", field: "linkJiraSitTe" },
  "1.2": { tag: "{{LINKJiraBug}}", field: "linkJiraBug" },
  "02-01": { tag: "{{LINKJIRAUAT}}", field: "linkJiraUatTe" },
};

// IT Control Checklist (02-03): inject link ke halaman SIT/UAT yang baru dibuat.
// Baris "01-01. ... Scenario Detail & Screen Capture SIT dan UAT" → LINKTITLEConfluenceSIT,
// baris "02-01. ... BAA & UAT Summary" → LINKTITLEConfluenceUAT.
const CHECKLIST_SIT_ROW = /01-01\.[^<]*?Scenario Detail[^<]*?SIT dan UAT/i;
const CHECKLIST_UAT_ROW = /02-01\.[^<]*?BAA\s*&\s*UAT Summary/i;

function applyChecklistLinks(body: string, ctx: FillContext): { body: string; linked: string[] } {
  const linked: string[] = [];
  let next = body;
  const sitPage = [...ctx.pages.values()].find((p) => /Scenario Detail/i.test(p.title));
  const uatPage = [...ctx.pages.values()].find((p) => /BAA\s*&\s*UAT Summary/i.test(p.title));
  if (sitPage) {
    next = next.replace(CHECKLIST_SIT_ROW, (m) => {
      linked.push("{{LINKTITLEConfluenceSIT}}");
      return pageLink(ctx.confluenceBase, sitPage.id, m);
    });
  }
  if (uatPage) {
    next = next.replace(CHECKLIST_UAT_ROW, (m) => {
      linked.push("{{LINKTITLEConfluenceUAT}}");
      return pageLink(ctx.confluenceBase, uatPage.id, m);
    });
  }
  return { body: next, linked };
}

export function anchor(url: string, text?: string): string {
  const safe = url.replaceAll('"', "&quot;");
  return `<a href="${safe}">${text ?? url}</a>`;
}

export function pageLink(confluenceBase: string, pageId: string, title: string): string {
  return anchor(`${confluenceBase}/pages/viewpage.action?pageId=${pageId}`, title);
}

const TAG_PATTERN = /\{\{[^}]+\}\}/g;

/** XML-escape nilai yang ditaro ke dalam storage-format body (SRS 7.4.7). */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Hitung body hasil fill untuk satu node. Mengembalikan `null` bila tidak ada
 * placeholder fillable (manual page / body tanpa tag) — page dibiarkan apa adanya.
 */
export async function fillForNode(key: string, body: string, ctx: FillContext): Promise<FillOutcome | null> {
  const tags = body.match(TAG_PATTERN);
  if (!tags) return null;

  const outcome: FillOutcome = { body, filled: [], blocked: [], unknown: [] };
  const replacements = new Map<string, string>();
  const unmatched: string[] = [];

  for (const tag of [...new Set(tags)]) {
    // {{idproject}} (case-insensitive) ← ID Project / Key (config.idProject).
    if (/^\{\{\s*idproject\s*\}\}$/i.test(tag)) {
      replacements.set(tag, escapeXml(ctx.config.idProject));
      continue;
    }
    if (TEXT_TAGS[tag]) {
      const value = String(ctx.config[TEXT_TAGS[tag]] || "").trim();
      if (value) replacements.set(tag, escapeXml(value));
      continue;
    }
    if (LINK_TAGS[tag]) {
      const url = String(ctx.config[LINK_TAGS[tag]] || "").trim();
      if (url) replacements.set(tag, anchor(url));
      continue;
    }
    if (LINKTITLE_TAGS[tag]) {
      const page = ctx.pages.get(LINKTITLE_TAGS[tag]);
      // BUGLIST dibiarkan kosong bila 1.2 tidak dibuat (FR-7.4.3).
      if (page) replacements.set(tag, pageLink(ctx.confluenceBase, page.id, page.title));
      continue;
    }
    if (COPYCONTENT_TAGS[tag]) {
      // Setiap tag SOP melakukan fetch sendiri walau sumbernya sama (FR-7.4.4).
      const source = String(ctx.config[COPYCONTENT_TAGS[tag]] || "").trim();
      if (source) {
        const sourceBody = await ctx.fetchPageBody(source);
        replacements.set(tag, sourceBody);
      }
      continue;
    }
    if (JIRA_MACRO_TAGS[tag]) {
      // Jira Issues macro — JQL ditebak dari key Test Execution (FR-7.4.8 open item).
      const spec = JIRA_MACRO_TAGS[tag];
      const teKey = extractJiraKey(String(ctx.config[spec.teField] || ""));
      if (teKey) replacements.set(tag, jiraMacroHtml(spec, teKey));
      else outcome.blocked.push(tag);
      continue;
    }
    unmatched.push(tag);
  }

  // Auto-link page (1.1 / 1.2 / 02-01): tag sama dengan tag link pada halaman lain.
  const autoLink = AUTO_LINK_TAGS[key as NodeKey];
  if (autoLink && !replacements.has(autoLink.tag)) {
    const url = String(ctx.config[autoLink.field] || "").trim();
    if (url) replacements.set(autoLink.tag, anchor(url));
  }

  outcome.unknown = unmatched.filter((tag) => !replacements.has(tag));

  let finalBody = replacements.size
    ? body.replaceAll(TAG_PATTERN, (tag) => replacements.get(tag) ?? tag)
    : body;

  // IT Control Checklist (02-03): inject link ke halaman SIT/UAT yang baru dibuat
  // (semua generate sudah selesai sebelum fill tahap ini — FR-7.3 table fill).
  if (key === "02-03") {
    const cl = applyChecklistLinks(finalBody, ctx);
    if (cl.linked.length) {
      finalBody = cl.body;
      outcome.filled.push(...cl.linked.filter((t) => !outcome.filled.includes(t)));
    }
  }

  if (!replacements.size) {
    if (!outcome.blocked.length && !outcome.unknown.length && !outcome.filled.length) return null;
    outcome.body = finalBody;
    return outcome;
  }

  outcome.body = finalBody;
  outcome.filled = [...new Set([...replacements.keys(), ...outcome.filled])];
  return outcome;
}