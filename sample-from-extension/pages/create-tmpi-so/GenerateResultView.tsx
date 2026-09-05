import React from "react";
import { Button } from "../../components/ui/button";

interface ResultScreen {
  phase: string;
  title: string;
  status: "success" | "failed" | "skipped" | string;
  pageId?: string;
  error?: string;
}

interface GenerateResultViewProps {
  results: ResultScreen[];
  successPct: number;
  failedPct: number;
  confBase?: string;
  verifying: boolean;
  verifyPages: any; // Sesuaikan dengan type page verification kamu
  onNew: () => void;
  onCheckAgain: () => void;
  onPersist: (data: any) => void;
  DonutComponent?: React.ComponentType<{ successPct: number }>;
  TagFixPanelComponent?: React.ComponentType<any>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  success: {
    label: "Success",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/60",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/60",
    dot: "bg-rose-500",
  },
  skipped: {
    label: "Skipped",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200/60",
    dot: "bg-amber-500",
  },
};

export default function GenerateResultView({
  results = [],
  successPct = 0,
  failedPct = 0,
  confBase,
  verifying,
  verifyPages,
  onNew,
  onCheckAgain,
  onPersist,
  DonutComponent,
  TagFixPanelComponent,
}: GenerateResultViewProps) {
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status !== "success").length;

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 font-sans text-slate-800 antialiased sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* HEADER & ACTION TOP BAR */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/10 uppercase tracking-wider">
                Execution Report
              </span>
              <span className="text-xs text-slate-400">
                • Total {results.length} Halaman
              </span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Hasil Generate TMP/ISO
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Ringkasan eksekusi pemuatan struktur dokumen di Confluence & Jira.
            </p>
          </div>

          <Button
            type="button"
            className="self-start sm:self-auto rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2"
            onClick={onNew}
          >
            <span>+</span> Generate New TMP/ISO
          </Button>
        </div>

        {/* METRICS & DONUT SUMMARY CARD */}
        <div className="grid gap-4 sm:grid-cols-12">
          {/* DONUT CHART CONTAINER */}
          <div className="sm:col-span-5 rounded-3xl border border-indigo-100/60 bg-white p-6 shadow-xl shadow-indigo-100/30 flex flex-col items-center justify-center relative overflow-hidden">
            <span className="absolute top-4 left-4 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Success Ratio
            </span>
            <div className="my-2 flex items-center justify-center">
              {DonutComponent ? (
                <DonutComponent successPct={successPct} />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 w-32 rounded-full border-8 border-indigo-50 bg-indigo-50/20">
                  <span className="text-2xl font-bold text-slate-800">
                    {successPct}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Berhasil
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* KPI CARDS (SUCCESS vs FAILED) */}
          <div className="sm:col-span-7 grid grid-cols-2 gap-4">
            {/* SUCCESS STAT CARD */}
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Berhasil
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-emerald-950">
                  {successCount}
                </div>
                <p className="mt-0.5 text-xs font-medium text-emerald-700">
                  {successPct}% dari total halaman
                </p>
              </div>
            </div>

            {/* FAILED STAT CARD */}
            <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                  Gagal
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-rose-950">
                  {failedCount}
                </div>
                <p className="mt-0.5 text-xs font-medium text-rose-700">
                  {failedPct}% butuh perhatian
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PER-PAGE RESULT TABLE */}
        <div className="rounded-3xl border border-indigo-100/60 bg-white shadow-xl shadow-indigo-100/30 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Detail Hasil pembuatan Halaman
              </h2>
              <p className="text-[11px] text-slate-400">
                Daftar lengkap status setiap node/halaman yang diproses.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-600">
              {results.length} Rows
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-4 py-3">Phase / Action</th>
                  <th className="px-4 py-3">Page Title</th>
                  <th className="px-6 py-3 text-right">Confluence Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {results.map((r, index) => {
                  const cfg = STATUS_CONFIG[r.status] || {
                    label: r.status,
                    bg: "bg-slate-50",
                    text: "text-slate-700",
                    border: "border-slate-200",
                    dot: "bg-slate-400",
                  };

                  return (
                    <tr
                      key={`${r.phase}-${r.pageId || index}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* STATUS BADGE */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}
                          />
                          {cfg.label}
                        </span>
                      </td>

                      {/* PHASE */}
                      <td className="px-4 py-3.5 font-medium text-slate-500 whitespace-nowrap">
                        {r.phase}
                      </td>

                      {/* TITLE + ERROR DETAIL */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800 block">
                          {r.title}
                        </span>
                        {r.error && (
                          <div className="mt-1 rounded-lg bg-rose-50/80 p-2 text-[11px] text-rose-700 border border-rose-100 break-all">
                            ⚠️ {r.error}
                          </div>
                        )}
                      </td>

                      {/* PAGE LINK */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        {r.pageId && confBase ? (
                          <a
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50/50 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-all"
                            href={`${confBase}/pages/viewpage.action?pageId=${r.pageId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            #{r.pageId} ↗
                          </a>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* VERIFIKASI PANEL CARD */}
        <div className="rounded-3xl border border-indigo-100/60 bg-white p-6 shadow-xl shadow-indigo-100/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span>🔍</span> Verifikasi Token Belum Terisi
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan ulang halaman untuk menemukan tag{" "}
                <code className="text-indigo-600 font-semibold">
                  {"{{...}}"}
                </code>{" "}
                yang belum terisi otomatis.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all self-start sm:self-auto"
              onClick={onCheckAgain}
              disabled={verifying}
            >
              {verifying ? "Scanning..." : "Check Ulang"}
            </Button>
          </div>

          {verifyPages !== null && TagFixPanelComponent && (
            <div className="mt-4">
              <TagFixPanelComponent
                pages={verifyPages}
                busy={verifying}
                confBase={confBase}
                onApply={onPersist}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
