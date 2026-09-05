import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applyFix, type FixAction, type VerifyPage } from "./lib/verify";

const keyOf = (pageId: string, tag: string) => `${pageId}::${tag}`;

export type PersistUpdate = { pageId: string; version: number; title: string; body: string };

/**
 * Panel scan & perbaiki {{...}} yang belum terisi. Dipakai di layar hasil generate
 * (Opsi 1) dan tab Verif TMP/ISO (Opsi 2).
 */
export function TagFixPanel({
  pages,
  busy,
  confBase,
  onApply,
}: {
  pages: VerifyPage[];
  busy: boolean;
  confBase: string;
  onApply: (updates: PersistUpdate[]) => Promise<void>;
}) {
  // per pageId::tag → aksi yang dipilih user (undefined = biarkan).
  const [edits, setEdits] = useState<Record<string, FixAction | undefined>>({});

  const isEmpty = pages.length === 0;
  const hasEdits = Object.values(edits).some(Boolean);

  const setAction = (pageId: string, tag: string, type: FixAction["type"]) =>
    setEdits((prev) => ({ ...prev, [keyOf(pageId, tag)]: { type, value: "" } }));

  const setValue = (pageId: string, tag: string, value: string) =>
    setEdits((prev) => {
      const cur = prev[keyOf(pageId, tag)];
      if (!cur) return prev;
      return { ...prev, [keyOf(pageId, tag)]: { ...cur, value } };
    });

  const clearTag = (pageId: string, tag: string) =>
    setEdits((prev) => ({ ...prev, [keyOf(pageId, tag)]: undefined }));

  const applyAll = async () => {
    // Kelompokkan aksi per halaman, terapkan ke body, lalu persist + refresh.
    const updates: PersistUpdate[] = [];
    for (const page of pages) {
      let body = page.body;
      let changed = false;
      for (const t of page.tags) {
        const action = edits[keyOf(page.id, t.tag)];
        if (!action) continue;
        const r = applyFix(body, t.tag, action);
        if (r.done > 0) {
          body = r.body;
          changed = true;
        }
      }
      if (changed) updates.push({ pageId: page.id, version: page.version, title: page.title, body });
    }
    if (!updates.length) return;
    await onApply(updates);
    setEdits({});
  };

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ✅ Tidak ada token {"{{...}}"} yang belum terisi pada halaman hasil generate.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-700">
          Ditemukan <strong>{pages.reduce((sum, p) => sum + p.tags.length, 0)}</strong> token{" "}
          {"{{...}}"} yang belum terisi pada <strong>{pages.length}</strong> halaman.
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => setEdits({})}
            disabled={!hasEdits || busy}
          >
            Bersihkan
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-indigo-600 text-xs text-white hover:bg-indigo-700"
            onClick={() => void applyAll()}
            disabled={!hasEdits || busy}
          >
            {busy ? "Menyimpan..." : "Terapkan"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {pages.map((page) => (
          <div key={page.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold text-slate-800">
              {page.title}{" "}
              <a
                className="ml-1 font-normal text-indigo-600 underline"
                href={confBase ? `${confBase}/pages/viewpage.action?pageId=${page.id}` : `#${page.id}`}
                target="_blank"
                rel="noreferrer"
              >
                #{page.id}
              </a>
            </p>
            <div className="space-y-2">
              {page.tags.map((t) => {
                const action = edits[keyOf(page.id, t.tag)];
                return (
                  <div key={t.tag} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-800">
                        {t.tag}
                      </code>
                      <span className="text-[10px] text-slate-400">x{t.count}</span>
                      <select
                        className="ml-auto h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                        value={action?.type || ""}
                        onChange={(e) => {
                          const v = e.target.value as FixAction["type"] | "";
                          if (v === "") clearTag(page.id, t.tag);
                          else setAction(page.id, t.tag, v);
                        }}
                      >
                        <option value="">Biarkan</option>
                        <option value="link">Isi Link</option>
                        <option value="text">Isi Teks</option>
                        <option value="remove">Hapus</option>
                      </select>
                    </div>
                    {action && action.type !== "remove" && (
                      <input
                        className="mt-2 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                        placeholder={action.type === "link" ? "https://..." : "Nilai teks..."}
                        value={action.value}
                        onChange={(e) => setValue(page.id, t.tag, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}