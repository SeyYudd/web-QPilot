import { useState } from "react";
import { ActionFooter } from "../../components/dashboard/ActionFooter";
import { CompareController } from "../../components/dashboard/CompareController";
import { ComparisonTable } from "../../components/dashboard/ComparisonTable";
import { MetricCards } from "../../components/dashboard/MetricCards";
import { LoadingOverlay } from "../../components/dashboard/LoadingOverlay";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { useCompareLogic } from "../../hooks/useCompareLogic";
import {
  extractPageId,
  macroKey,
  tableKey,
  testCaseMacros,
  updateConfluence,
} from "../../lib/confluence-api";
import { createJiraClient } from "../../lib/jira-api";
import type { ComparisonResult } from "../../types";
import JiraTeView from "../jira-te/JiraTeView";

export default function CheckSyncTeView() {
  const [syncTab, setSyncTab] = useState<"jira" | "compare">("compare");
  const [pageId, setPageId] = useState("");
  const [executionKey, setExecutionKey] = useState("");
  const [connection, setConnection] = useState({ jiraBase: "", confBase: "" });
  const [busyAction, setBusyAction] = useState(false);

  const {
    rows,
    summary,
    loading,
    message,
    tone,
    dismissMessage,
    compare,
    fixPosition,
  } = useCompareLogic();

  const [fixPreviewOpen, setFixPreviewOpen] = useState(false);
  const [addModeRow, setAddModeRow] = useState<ComparisonResult | null>(null);

  const runCompare = async () => {
    const result = await compare(
      pageId.trim(),
      executionKey.trim().toUpperCase()
    );
    if (result)
      setConnection({ jiraBase: result.jiraBase, confBase: result.confBase });
  };

  const mutateRow = async (
    row: ComparisonResult,
    action: "add" | "remove",
    displayMode?: "expand" | "table"
  ) => {
    setBusyAction(true);
    try {
      const client = createJiraClient(connection.jiraBase);
      const normalizedPageId = extractPageId(pageId) || pageId.trim();
      await updateConfluence(
        client,
        connection.confBase,
        normalizedPageId,
        (doc) => {
          const macros = testCaseMacros(doc);
          const targets = macros.filter(
            (node) => tableKey(node) === row.key.toUpperCase()
          );
          if (action === "remove") {
            targets.forEach((target) => {
              const parent = target.closest("ac\\:structured-macro");
              (parent || target).remove();
            });
            return true;
          }
          if (action === "add" && targets.length)
            throw new Error(`${row.key} sudah ada di Confluence SIT.`);
          const container =
            macros.find(
              (node) =>
                node.parentElement?.tagName.toLowerCase() === "ac:layout-cell"
            )?.parentElement || doc.body;
          const nextOrder = typeof row.order === "number" ? row.order + 1 : -1;
          const next = macros.find(
            (node) =>
              macroKey(node) ===
              (
                rows.find((candidate) => candidate.order === nextOrder)?.key ||
                ""
              ).toUpperCase()
          );
          const html =
            window.QPilotSitTemplateBuilder?.buildSingleTcHtml(
              {
                key: row.key,
                summary: row.summary || row.key,
                scenario: row.scenario || row.summary || row.key,
                functionName: row.functionName || executionKey,
                steps: row.steps || [
                  {
                    action: "Langkah test",
                    data: "Data test",
                    expectedResult: "Expected result",
                  },
                ],
              },
              Number(row.order) - 1,
              displayMode || "expand"
            ) || "";
          if (!html)
            throw new Error(`Template untuk ${row.key} tidak tersedia.`);
          if (next) next.insertAdjacentHTML("beforebegin", html);
          else container.insertAdjacentHTML("beforeend", html);
          return true;
        }
      );
      await runCompare();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : `Gagal ${action === "add" ? "menambahkan" : "menghapus"} ${row.key} di Confluence.`
      );
    } finally {
      setBusyAction(false);
    }
  };

  const canFix = rows.some((row) => typeof row.order === "number");

  const compareView = (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <CompareController
        pageId={pageId}
        executionKey={executionKey}
        setPageId={setPageId}
        setExecutionKey={setExecutionKey}
        onCompare={() => void runCompare()}
        loading={loading}
      />
      <Card className="rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-base font-serif font-semibold text-slate-900">
              Comparison Results
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Xray Test Run, Confluence position, and Screen Capture validation.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {summary.jiraTotal} Jira TC
          </span>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <MetricCards summary={summary} />
          {rows.length ? (
            <ComparisonTable
              rows={rows}
              onAdd={(row) => setAddModeRow(row)}
              onRemove={(row) => {
                if (window.confirm(`Hapus ${row.key} dari Confluence SIT?`))
                  void mutateRow(row, "remove");
              }}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center text-xs text-slate-400 font-medium">
              Masukkan Page ID dan Jira TE, lalu klik tombol <span className="font-semibold text-slate-600">Compare</span>.
            </div>
          )}
          <ActionFooter
            canFix={canFix}
            loading={loading || busyAction}
            onFix={() => setFixPreviewOpen(true)}
          />

          <Dialog
            open={fixPreviewOpen}
            title="Preview Fix Position"
            onClose={() => setFixPreviewOpen(false)}
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Perubahan nama/posisi Confluence yang akan diterapkan secara otomatis:
              </p>
              <div className="max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700 space-y-1">
                {rows
                  .filter((row) => row.status !== "Extra di Confluence")
                  .map((row, index) => (
                    <p key={row.key} className="py-0.5 border-b border-slate-200/50 last:border-0">
                      {index + 1}. <strong className="text-slate-900">{row.key}</strong>: posisi Confluence{" "}
                      <span className="text-indigo-600">{row.position < 0 ? "baru" : row.position + 1}</span> &rarr;{" "}
                      <span className="text-emerald-600 font-bold">{index + 1}</span>
                    </p>
                  ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200 text-xs font-semibold text-slate-600"
                  onClick={() => setFixPreviewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700"
                  onClick={() => {
                    setFixPreviewOpen(false);
                    void fixPosition(pageId, connection.jiraBase, connection.confBase)
                      .then(() => runCompare())
                      .catch(() => {});
                  }}
                >
                  Confirm Fix Position
                </Button>
              </div>
            </div>
          </Dialog>

          <Dialog
            open={Boolean(addModeRow)}
            title={`Add ${addModeRow?.key || "Test Case"}`}
            onClose={() => setAddModeRow(null)}
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Pilih format struktur tampilan test case yang akan ditambahkan ke Confluence:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 shadow-sm"
                  onClick={() => {
                    if (addModeRow) void mutateRow(addModeRow, "add", "expand");
                    setAddModeRow(null);
                  }}
                >
                  <div className="text-lg text-indigo-600 font-bold mb-1">▾</div>
                  <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                    Expandable
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Table wrapped inside Expand macro
                  </div>
                </button>
                <button
                  type="button"
                  className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 shadow-sm"
                  onClick={() => {
                    if (addModeRow) void mutateRow(addModeRow, "add", "table");
                    setAddModeRow(null);
                  }}
                >
                  <div className="text-lg text-indigo-600 font-bold mb-1">▤</div>
                  <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                    Direct Table
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Inline table without Expand macro
                  </div>
                </button>
              </div>
            </div>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
                <div className="space-y-6 animate-fadeIn">
            {/* SUB-TAB TOGGLE */}
            <div className="inline-flex rounded-2xl bg-white p-1 border border-slate-200/80 shadow-sm">
              <Button
                variant="ghost"
                onClick={() => setSyncTab("compare")}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                  syncTab === "compare"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compare Jira TE & Confluence
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSyncTab("jira")}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                  syncTab === "jira"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Jira TE View
              </Button>
            </div>

            <div>
              {syncTab === "jira" ? (
                <JiraTeView
                  executionKey={executionKey}
                  onChanged={() => void runCompare()}
                />
              ) : (
                compareView
              )}
            </div>
          </div>
      {/* SYSTEM DIALOG */}
      <Dialog
        open={Boolean(message)}
        title={tone === "error" ? "Gagal" : tone === "success" ? "Berhasil" : "Info"}
        onClose={dismissMessage}
      >
        <div className="space-y-4">
          <div
            className={`rounded-2xl p-4 text-xs font-medium flex items-center gap-3 border ${
              tone === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : tone === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-indigo-50 text-indigo-900 border-indigo-200"
            }`}
          >
            <span className="text-base">
              {tone === "error" ? "🚨" : tone === "success" ? "✅" : "ℹ️"}
            </span>
            <p className="text-sm leading-relaxed">{message}</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 transition-all"
              onClick={dismissMessage}
            >
              OK
            </Button>
          </div>
        </div>
      </Dialog>

      <LoadingOverlay open={loading || busyAction} />
    </>
  );
}
