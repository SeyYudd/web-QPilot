import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getConfluenceBaseUrl } from "@/lib/auth/session";
import { createTmpIsoApi, type TmpIsoApi } from "../create-tmpi-so/lib/generate";
import { persistFixes, scanTreeFromRoot, type VerifyPage } from "../create-tmpi-so/lib/verify";
import { TagFixPanel, type PersistUpdate } from "../create-tmpi-so/TagFixPanel";

const fieldClass =
  "mt-1.5 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300";

export default function VerifyTmpIsoView() {
  const [rootPageId, setRootPageId] = useState("");
  const [confBase, setConfBase] = useState("");
  const [api, setApi] = useState<TmpIsoApi | null>(null);
  const [pages, setPages] = useState<VerifyPage[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const runScan = async () => {
    const id = rootPageId.trim();
    if (!id) {
      setError("Root Page ID wajib diisi.");
      return;
    }
    setError("");
    setScanning(true);
    try {
      const base = await getConfluenceBaseUrl();
      const createdApi = createTmpIsoApi(base);
      setConfBase(base);
      setApi(createdApi);
      setPages(await scanTreeFromRoot(createdApi, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan gagal.");
    } finally {
      setScanning(false);
    }
  };

  const applyFixes = async (updates: PersistUpdate[]) => {
    if (!api) return;
    await persistFixes(api, updates);
    setPages(await scanTreeFromRoot(api, rootPageId.trim()));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      {/* HEADER SECTION */}
      <div className="text-center sm:text-left">
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Verif TMP/ISO
        </h1>
        <p className="mt-1.5 text-xs font-normal text-slate-500 sm:text-sm">
          Scan TMP/ISO di Confluence, temukan token <code className="rounded bg-slate-100 px-1.5 py-0.5 text-indigo-600 font-mono text-xs">{"{{...}}"}</code> yang belum terisi, lalu perbaiki secara instan.
        </p>
      </div>

      {/* MAIN CONTAINER */}
      <Card className="rounded-3xl border border-indigo-100/60 bg-white shadow-xl shadow-indigo-100/30 overflow-hidden transition-all">
        <CardHeader className="border-b border-slate-100/80 bg-slate-50/50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
              🔍
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Scan Pohon Halaman</h2>
              <p className="text-xs text-slate-500 mt-0.5">Masukkan Root Page ID dari tree TMP/ISO yang mau diverifikasi.</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* INPUT & ACTION BUTTON */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Root Page ID <span className="text-rose-500">*</span>
              </label>
              <input
                className={fieldClass}
                placeholder="Contoh: 2097316259"
                value={rootPageId}
                onChange={(e) => setRootPageId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runScan()}
              />
            </div>
            <Button
              type="button"
              className="h-10 rounded-xl bg-indigo-600 px-6 text-xs font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-70"
              onClick={() => void runScan()}
              disabled={scanning}
            >
              {scanning ? (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Scanning...</span>
                </div>
              ) : (
                "Scan Tree"
              )}
            </Button>
          </div>

          {/* ALERT ERROR */}
          {error && (
            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/90 p-4 text-xs text-rose-800 shadow-sm backdrop-blur-md flex items-center gap-2 animate-fadeIn">
              <span>🚨</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* SCAN RESULT / PANEL FIX */}
          {pages !== null && confBase && (
            <div className="pt-2 animate-fadeIn">
              <TagFixPanel pages={pages} busy={scanning} confBase={confBase} onApply={applyFixes} />
            </div>
          )}

          {/* EMPTY STATE (SEBELUM DI-SCAN) */}
          {pages === null && !scanning && !error && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-xs text-slate-400 font-medium">
                Ketikkan Root Page ID di atas lalu klik <span className="font-semibold text-slate-600">"Scan Tree"</span> untuk memuat daftar halaman.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}