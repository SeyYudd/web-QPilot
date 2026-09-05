// lib/tmp-iso/fill-rules.ts — Dispatch fill rule per jenis placeholder
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
};

/** Tag self-reference ke page hasil generate pada run yang sama (7.2). */
export const LINKTITLE_TAGS: Record<string, NodeKey> = {
  "{{LINKTITLEConfluenceSIT}}": "01",
  "{{LINKTITLEConfluenceUAT}}": "02",
  "{{LINKTITLEConfluenceDeployment}}": "03",
};

/** Tag copy-content → field config sumber (URL/page id halaman Confluence). */
export const COPYCONTENT_TAGS: Record<string, keyof TmpIsoProjectConfig> = {
  "{{COPYCONTENTMIG}}": "linkMigDev",
  "{{COPYCONTENTSOPDEPLOYMENT}}": "linkSystemDesignDev",
  "{{COPYCONTENTSOPMAINTENANCE}}": "linkSystemDesignDev",
  "{{COPYCONTENTSOPMONITORING}}": "linkSystemDesignDev",
  "{{COPYCONTENTSOPTROUBLESHOOTING}}": "linkSystemDesignDev",
};

// TODO(open item FR-7.4.8): JQL/filter per Jira Issues macro belum dikonfirmasi
// dari screenshot macro asli. JANGAN mengisi nilai ini dengan tebakan — konfirmasi
// dulu, lalu isi JQL di sini dan hapus status "blocked" di fillForNode.
export const JIRA_MACRO_TAGS: Record<string, string | null> = {
  "{{LINKJIRAMACROUQA}}": null,
  "{{LINKJIRAMACROSITJIRATESTPLAN}}": null,
  "{{LINKJIRAMACROUATJIRATESTPLAN}}": null,
  "{{LINKJIRAMACRDEPLOYMENTJIRATESTPLAN}}": null,
};

/** Auto-link page (7.3): key node → tag di body page tersebut. */
export const AUTO_LINK_TAGS: Partial<Record<NodeKey, { tag: string; field: keyof TmpIsoProjectConfig }>> = {
  "1.1": { tag: "{{LINKJIRASIT}}", field: "linkJiraSitTe" },
  "1.2": { tag: "{{LINKJiraBug}}", field: "linkJiraBug" },
  "02-01": { tag: "{{LINKJIRAUAT}}", field: "linkJiraUatTe" },
};

// 02-03 IT Control Checklist (Table fill): kolom SIT/UAT/Bug link memakai tag
// link yang sama dengan halaman lain. Markup tabel persisnya belum dikonfirmasi —
// TODO: verifikasi terhadap template asli; untuk sekarang tag dikenali generik.
export const TABLE_FILL_NODES: NodeKey[] = ["02-03"];

export function anchor(url: string, text?: string): string {
  const safe = url.replaceAll('"', "&quot;");
  return `<a href="${safe}">${text ?? url}</a>`;
}

export function pageLink(confluenceBase: string, pageId: string, title: string): string {
  return anchor(`${confluenceBase}/pages/viewpage.action?pageId=${pageId}`, title);
}

const TAG_PATTERN = /\{\{[^}]+\}\}/g;

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
    if (tag in JIRA_MACRO_TAGS) {
      // Open item FR-7.4.8: JQL belum dikonfirmasi — tag dilaporkan blocked, bukan ditebak.
      outcome.blocked.push(tag);
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
  if (!replacements.size) {
    if (!outcome.blocked.length && !outcome.unknown.length) return null;
    outcome.body = body;
    return outcome;
  }

  outcome.body = body.replaceAll(TAG_PATTERN, (tag) => replacements.get(tag) ?? tag);
  outcome.filled = [...replacements.keys()];
  return outcome;
}
