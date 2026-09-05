// lib/tmp-iso/generate.ts — Orkestrasi 2 fase Create TMP/ISO (srs-automation-tmp.md FR-7.4):
// fase copy (duplikasi tree, body mentah) lalu fase fill (PUT per page).
// Semua panggilan Confluence lewat TmpIsoApi yang dibangun di atas
// createConfluenceClient (apiFetch) — tidak ada fetch mentah di modul ini.
import { createConfluenceClient } from "@/lib/api/confluence";
import { extractPageId } from "@/lib/confluence-api";
import { fillForNode, type FillContext } from "./fill-rules";
import { buildPageTree, nodeKeyForTitle, substituteTitle } from "./page-tree";
import type { PageResult, TmpIsoPage, TmpIsoProjectConfig } from "./types";

export interface TmpIsoApi {
  getPage(pageId: string): Promise<TmpIsoPage>;
  getChildren(pageId: string): Promise<Array<{ id: string; title: string; version: number; body: string }>>;
  createPage(input: { title: string; spaceKey: string; parentPageId?: string; body: string }): Promise<{ id: string }>;
  updatePage(input: { pageId: string; version: number; title: string; body: string }): Promise<void>;
  findByTitle(spaceKey: string, title: string): Promise<Array<{ id: string; title: string }>>;
}

export function createTmpIsoApi(confBase: string): TmpIsoApi {
  const client = createConfluenceClient(confBase);
  const storageExpand = "expand=body.storage,version";
  return {
    async getPage(pageId) {
      const page = await client.request<{ id: string; title: string; version?: { number?: number }; body?: { storage?: { value?: string } } }>(
        `${confBase}/rest/api/content/${encodeURIComponent(pageId)}?${storageExpand}`,
      );
      return { id: page.id, title: page.title, version: page.version?.number || 1, body: page.body?.storage?.value || "" };
    },
    async getChildren(pageId) {
      const res = await client.request<{ results?: Array<{ id: string; title: string; version?: { number?: number }; body?: { storage?: { value?: string } } }> }>(
        `${confBase}/rest/api/content/${encodeURIComponent(pageId)}/child/page?limit=500&${storageExpand}`,
      );
      return (res.results || []).map((page) => ({ id: page.id, title: page.title, version: page.version?.number || 1, body: page.body?.storage?.value || "" }));
    },
    async createPage({ title, spaceKey, parentPageId, body }) {
      const saved = await client.request<{ id: string }>(`${confBase}/rest/api/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page",
          title,
          space: { key: spaceKey.toUpperCase() },
          ...(parentPageId ? { ancestors: [{ id: parentPageId }] } : {}),
          body: { storage: { value: body, representation: "storage" } },
        }),
      });
      return { id: saved.id };
    },
    async updatePage({ pageId, version, title, body }) {
      await client.request(`${confBase}/rest/api/content/${encodeURIComponent(pageId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page",
          title,
          version: { number: version + 1 },
          body: { storage: { value: body, representation: "storage" } },
        }),
      });
    },
    async findByTitle(spaceKey, title) {
      const res = await client.request<{ results?: Array<{ id: string; title: string }> }>(
        `${confBase}/rest/api/content?spaceKey=${encodeURIComponent(spaceKey.toUpperCase())}&title=${encodeURIComponent(title)}&expand=version`,
      );
      return res.results || [];
    },
  };
}

export type CreatedPage = {
  key: string;
  title: string;
  pageId: string;
  version: number;
  body: string;
};

export type CopyFailure = {
  key: string;
  title: string;
  templatePageId: string;
  parentCreatedPageId?: string;
  error: string;
};

export type GenerateResult = {
  results: PageResult[];
  pages: CreatedPage[];
  copyFailures: CopyFailure[];
};

export type GenerateCallbacks = {
  /** Dipanggil setiap satu page selesai (copy maupun fill). */
  onProgress?: (result: PageResult) => void;
};

/** FR-7.4.7 — deteksi tree yang sudah ada untuk idProject yang sama. */
export async function checkExistingTree(config: TmpIsoProjectConfig, api: TmpIsoApi): Promise<boolean> {
  const rootTitle = buildPageTree(config)[0].title;
  const existing = await api.findByTitle(config.targetSpaceKey, rootTitle);
  return existing.length > 0;
}

function makeFillContext(config: TmpIsoProjectConfig, pages: CreatedPage[], api: TmpIsoApi, confluenceBase: string): FillContext {
  return {
    config,
    pages: new Map(pages.map((page) => [page.key, { id: page.pageId, title: page.title }])),
    confluenceBase,
    // Copy-content: setiap tag fetch independen; sumber boleh page id atau URL.
    fetchPageBody: async (pageRef) => {
      const id = extractPageId(pageRef) || pageRef.trim();
      const page = await api.getPage(id);
      return page.body;
    },
  };
}

/** Ambil seluruh subtree template (root + descendants) dengan body mentah. */
async function fetchTemplateTree(api: TmpIsoApi, rootPageId: string): Promise<Array<{ id: string; title: string; parentTemplateId?: string; version: number; body: string }>> {
  const root = await api.getPage(rootPageId);
  const all: Array<{ id: string; title: string; parentTemplateId?: string; version: number; body: string }> = [{ id: root.id, title: root.title, parentTemplateId: undefined, version: root.version, body: root.body }];
  const queue = [root.id];
  while (queue.length) {
    const parentId = queue.shift() as string;
    const children = await api.getChildren(parentId);
    for (const child of children) {
      all.push({ id: child.id, title: child.title, parentTemplateId: parentId, version: child.version, body: child.body });
      queue.push(child.id);
    }
  }
  return all;
}

/**
 * Jalankan generate lengkap: copy phase lalu fill phase. Kegagalan per page
 * dilaporkan, page yang sudah sukses tidak di-rollback (FR-7.4.6).
 */
export async function generateTmpIsoTree(config: TmpIsoProjectConfig, api: TmpIsoApi, confluenceBase: string, callbacks: GenerateCallbacks = {}): Promise<GenerateResult> {
  const results: PageResult[] = [];
  const pages: CreatedPage[] = [];
  const copyFailures: CopyFailure[] = [];
  const report = (result: PageResult) => {
    results.push(result);
    callbacks.onProgress?.(result);
  };

  // ===== FASE 1: COPY — duplikasi tree, body mentah apa adanya (tag {{...}} utuh) =====
  const templateTree = await fetchTemplateTree(api, config.templateRootPageId);
  const templateToCreated = new Map<string, string>(); // templatePageId → createdPageId

  for (const template of templateTree) {
    const key = nodeKeyForTitle(template.title) || template.id;
    // FR-7.4.3 — 1.2 Bug List tidak dibuat bila link bug kosong.
    if (key === "1.2" && !config.linkJiraBug?.trim()) continue;
    const title = substituteTitle(template.title, config);
    const parentCreatedPageId = template.parentTemplateId ? templateToCreated.get(template.parentTemplateId) : undefined;
    try {
      const saved = await api.createPage({ title, spaceKey: config.targetSpaceKey, parentPageId: parentCreatedPageId, body: template.body });
      templateToCreated.set(template.id, saved.id);
      pages.push({ key, title, pageId: saved.id, version: 1, body: template.body });
      report({ key, title, status: "success", phase: "copy", pageId: saved.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      copyFailures.push({ key, title, templatePageId: template.id, parentCreatedPageId, error: message });
      report({ key, title, status: "failed", phase: "copy", error: message });
    }
  }

  // ===== FASE 2: FILL — PUT per page, ganti placeholder sesuai 7.3 =====
  await fillPages(config, api, confluenceBase, pages, { onProgress: report });

  return { results, pages, copyFailures };
}

/**
 * Fill phase terisolasi agar bisa dipakai ulang oleh "Retry Failed Only":
 * hanya page pada `pages` yang di-PUT ulang.
 */
export async function fillPages(
  config: TmpIsoProjectConfig,
  api: TmpIsoApi,
  confluenceBase: string,
  pages: CreatedPage[],
  callbacks: GenerateCallbacks = {},
): Promise<void> {
  const ctx = makeFillContext(config, pages, api, confluenceBase);
  for (const page of pages) {
    let outcome;
    try {
      outcome = await fillForNode(page.key, page.body, ctx);
    } catch (error) {
      callbacks.onProgress?.({ key: page.key, title: page.title, status: "failed", phase: "fill", pageId: page.pageId, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (!outcome || !outcome.filled.length) {
      // Manual page / tidak ada placeholder fillable — dibiarkan apa adanya (FR-7.4.5).
      callbacks.onProgress?.({ key: page.key, title: page.title, status: "unfilled", phase: "fill", pageId: page.pageId, unknown: outcome?.unknown });
      continue;
    }
    if (outcome.blocked.length) {
      // Ada tag macro Jira yang JQL-nya belum dikonfirmasi (FR-7.4.8) — jangan commit body setengah jadi.
      callbacks.onProgress?.({ key: page.key, title: page.title, status: "blocked", phase: "fill", pageId: page.pageId, filled: outcome.filled, blocked: outcome.blocked, unknown: outcome.unknown });
      continue;
    }
    try {
      await api.updatePage({ pageId: page.pageId, version: page.version, title: page.title, body: outcome.body });
      callbacks.onProgress?.({ key: page.key, title: page.title, status: "success", phase: "fill", pageId: page.pageId, filled: outcome.filled, unknown: outcome.unknown });
    } catch (error) {
      callbacks.onProgress?.({ key: page.key, title: page.title, status: "failed", phase: "fill", pageId: page.pageId, filled: outcome.filled, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

