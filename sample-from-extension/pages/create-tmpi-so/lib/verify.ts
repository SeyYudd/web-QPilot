// lib/verify.ts — Scan & perbaiki token {{...}} yang belum terisi setelah generate.
// Inti bersama untuk "Check Ulang" (layar hasil) dan tab terpisah "Verif TMP/ISO".
// Murni logika bisnis; I/O Confluence lewat TmpIsoApi.
import type { TmpIsoApi } from "./generate";

const TAG_PATTERN = /\{\{[^}]+\}\}/g;

export type TagOccurrence = {
  tag: string;
  count: number;
};

export type VerifyPage = {
  id: string;
  title: string;
  version: number;
  body: string;
  tags: TagOccurrence[];
};

/** Kumpulkan semua token {{...}} yang muncul di body, dengan jumlah kemunculan tiap token. */
export function collectUnresolvedTags(body: string): TagOccurrence[] {
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  TAG_PATTERN.lastIndex = 0;
  while ((m = TAG_PATTERN.exec(body)) !== null) {
    counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count }));
}

/** Scan daftar halaman (id) → kembalikan hanya halaman yang masih punya {{...}}. */
export async function scanPages(api: TmpIsoApi, pageIds: string[]): Promise<VerifyPage[]> {
  const out: VerifyPage[] = [];
  for (const id of pageIds) {
    const page = await api.getPage(id);
    const tags = collectUnresolvedTags(page.body);
    if (tags.length) out.push({ id: page.id, title: page.title, version: page.version, body: page.body, tags });
  }
  return out;
}

/** Traversal penuh subtree dari root page (contoh: tab Verif TMP/ISO). */
export async function scanTreeFromRoot(api: TmpIsoApi, rootPageId: string): Promise<VerifyPage[]> {
  const ids: string[] = [];
  const root = await api.getPage(rootPageId);
  ids.push(root.id);
  const queue = [root.id];
  while (queue.length) {
    const parentId = queue.shift() as string;
    const children = await api.getChildren(parentId);
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return scanPages(api, ids);
}

export type FixAction =
  | { type: "link"; value: string }
  | { type: "text"; value: string }
  | { type: "remove" };

function escapeXmlValue(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Terapkan satu aksi ke semua kemunculan `tag` di body; kembalikan body baru + jumlah terganti. */
export function applyFix(body: string, tag: string, action: FixAction): { body: string; done: number } {
  let replacement: string;
  switch (action.type) {
    case "link": {
      const url = action.value.trim().replaceAll('"', "&quot;");
      replacement = `<a href="${url}">${url}</a>`;
      break;
    }
    case "text":
      replacement = escapeXmlValue(action.value);
      break;
    case "remove":
      replacement = "";
      break;
  }
  const re = new RegExp(escapeRegExp(tag), "g");
  let done = 0;
  const next = body.replace(re, () => {
    done += 1;
    return replacement;
  });
  return { body: next, done };
}

/** Persist body hasil fix ke Confluence via PUT. `updates` berisi versi body yang sudah berubah. */
export async function persistFixes(
  api: TmpIsoApi,
  updates: Array<{ pageId: string; version: number; title: string; body: string }>,
): Promise<void> {
  for (const u of updates) {
    await api.updatePage({ pageId: u.pageId, version: u.version, title: u.title, body: u.body });
  }
}