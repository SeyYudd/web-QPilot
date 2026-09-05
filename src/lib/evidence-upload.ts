// lib/evidence-upload.ts — Upload evidence screenshot ke expand target di
// halaman Confluence (mirror alur background upload extension, versi web):
// POST attachment multipart → GET storage → sisipkan <ac:image> ke expand
// target → PUT update dengan version+1. Semua request lewat apiFetch choke
// point (proxy rewrite + PAT Confluence + header XSRF otomatis).

import { apiFetch, loadSession, AuthError } from "./auth/session";

/** Nama file attachment unik agar tidak menabrak attachment lama di page. */
function uniqueFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
}

async function requireConfluencePat(): Promise<string> {
  const session = loadSession();
  if (!session) throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  return session.confluencePat;
}

async function fetchPage(confBase: string, pageId: string, pat: string) {
  const response = await apiFetch(
    `${confBase}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version`,
    { method: "GET" },
    pat,
  );
  if (response.status === 401) {
    throw new AuthError("TOKEN_EXPIRED", "Session habis, silakan masukkan PAT baru.");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} saat membaca page Confluence.`);
  const page = (await response.json()) as {
    title?: string;
    version?: { number?: number };
    body?: { storage?: { value?: string } };
  };
  return page;
}

// Self-closing fix yang sama dengan updateConfluenceExpand di UploadCaptureView.
function serializeStorage(doc: Document): string {
  return doc.body.innerHTML.replace(
    /<(br|hr|img|input|meta|link|col|source)(\s[^>]*)?>/gi,
    (tag, name: string, attrs = "") => (/\/\s*>$/.test(tag) ? tag : `<${name}${attrs} />`),
  );
}

/**
 * Upload satu file sebagai attachment lalu sisipkan <ac:image> (+ caption,
 * bila ada) ke dalam expand target di bawah root expand scenario yang dipilih.
 * Scoping dua tingkat: root expand scenario (judul mengandung scenarioId) →
 * expand target di dalamnya — sama seperti pemetaan di updateConfluenceExpand.
 * Retry otomatis sekali pada HTTP 409 (version conflict).
 */
export async function uploadEvidenceToExpand(
  confBase: string,
  pageId: string,
  file: Blob,
  fileName: string,
  scenarioId: string,
  expandTitle: string,
  caption = "",
): Promise<void> {
  const pat = await requireConfluencePat();
  const attachmentName = uniqueFileName(fileName);

  // 1. POST attachment (multipart; JANGAN set Content-Type manual — biarkan
  // browser menambahkan boundary FormData).
  const form = new FormData();
  form.append("file", file, attachmentName);
  const uploadRes = await apiFetch(
    `${confBase}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment`,
    { method: "POST", body: form },
    pat,
  );
  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new Error(`Gagal upload attachment. Status: ${uploadRes.status}. Detail: ${detail.substring(0, 100)}`);
  }

  // 2. Sisipkan caption (bila ada) + <ac:image> ke expand target + PUT update.
  // Urutan mengikuti extension: caption di atas, image di paragraf sendiri.
  const kodeImg = `<ac:image ac:width="450"><ri:attachment ri:filename="${attachmentName}" /></ac:image>&nbsp;`;
  const captionHtml = caption
    ? `<p>${caption.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await fetchPage(confBase, pageId, pat);
    const doc = new DOMParser().parseFromString(page.body?.storage?.value || "", "text/html");
    // Root expand scenario: judulnya mengandung scenarioId (mis. "TC001 - ...").
    const root = [...doc.querySelectorAll("ac\\:structured-macro")]
      .filter((node) => (node.getAttribute("ac:name") || "").toLowerCase() === "expand")
      .find((node) =>
        (node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent || "").includes(scenarioId),
      );
    if (!root) throw new Error("Scenario tidak ditemukan di Confluence.");
    const rootBody = root.querySelector("ac\\:rich-text-body") || root;
    const target = [...rootBody.querySelectorAll("ac\\:structured-macro")]
      .filter((node) => (node.getAttribute("ac:name") || "").toLowerCase() === "expand")
      .find(
        (node) =>
          (node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent || "").trim() ===
          expandTitle,
      );
    if (!target) throw new Error(`Expand Section "${expandTitle}" tidak ditemukan di Confluence.`);
    const body = target.querySelector("ac\\:rich-text-body") || target;
    // Lanjutkan paragraf evidence terakhir bila masih "kosong" (hanya &nbsp; +
    // < 3 image) agar evidence satu section tetap menyatu seperti extension.
    const paragraphs = [...body.children].filter((node) => node.tagName.toLowerCase() === "p");
    const lastP = paragraphs[paragraphs.length - 1];
    const lastImages = lastP ? lastP.querySelectorAll("ac\\:image").length : 0;
    const lastIsEmpty = lastP ? !lastP.textContent.replace(/\u00a0/g, " ").trim() : false;
    if (lastP && lastImages > 0 && lastImages < 3 && lastIsEmpty) {
      lastP.insertAdjacentHTML("beforeend", captionHtml + `<p>${kodeImg}</p>`);
    } else {
      body.insertAdjacentHTML("beforeend", `${captionHtml}<p>${kodeImg}</p>`);
    }
    const value = serializeStorage(doc);
    const putRes = await apiFetch(
      `${confBase}/rest/api/content/${encodeURIComponent(pageId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "page",
          title: page.title,
          version: { number: (page.version?.number || 1) + 1 },
          body: { storage: { value, representation: "storage" } },
        }),
      },
      pat,
    );
    if (putRes.ok) return;
    if (putRes.status === 409 && attempt === 1) continue; // version conflict → baca ulang & coba lagi
    const detail = await putRes.text().catch(() => "");
    throw new Error(`Gagal menyisipkan gambar ke page. Status: ${putRes.status}. Detail: ${detail.substring(0, 100)}`);
  }
}
