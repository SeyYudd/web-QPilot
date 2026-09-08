import { Fragment, useMemo, useState } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader } from "../../ui/card";
import { Dialog } from "../../ui/dialog";
import { Toast } from "../../ui/toast";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { downloadTemplate as downloadTemplateXlsx, parseXlsx } from "./spreadsheet";
import { processRow } from "./jiraImport";
import { getJiraBaseUrl } from "@/lib/auth/session";
import { emptyRow, valid, type Row, type Step } from "./types";

function LinkCell({ href, label }: { href: string; label: string }) { if (!label) return <span>-</span>; return <a className="text-brand underline" href={href} target="_blank" rel="noreferrer">{label}</a>; }

export function ImportTestCaseView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [hasBeenSubmittedOnce, setHasBeenSubmittedOnce] = useState(false);
  const [importBaruOpen, setImportBaruOpen] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "success" | "error" } | null>(null);
  const selected = useMemo(() => rows.filter((row) => row.selected && !row.error), [rows]);
  const failedCount = rows.filter((row) => row.result === "failed").length;
  // Membedakan kondisi "belum pernah submit" (draft) vs "sudah pernah dijalankan & selesai" (completed).
  const mode = running ? "running" : (hasBeenSubmittedOnce ? "completed" : "draft");
  const isSuccess = (row: Row) => row.result === "created" || row.result === "linked";
  const resetImport = () => { setRows([]); setHasBeenSubmittedOnce(false); setExpanded(null); setEdit(null); setConfirmOpen(false); setImportBaruOpen(false); };
  const startImportBaru = () => { if (failedCount > 0) setImportBaruOpen(true); else resetImport(); };
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch, error: valid({ ...row, ...patch }) } : row));
  const setRowResult = (no: number, patch: Partial<Row>) => setRows((current) => current.map((row) => row.no === no ? { ...row, ...patch } : row));
  const addScenario = (row: Row) => { setRows((current) => [...current, { ...row, no: current.length + 1, error: valid(row) }]); setAddOpen(false); };
  const removeRow = (index: number) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, no: rowIndex + 1 })));

  const downloadTemplate = () => {
    try { downloadTemplateXlsx(); setTemplate("Template berhasil diunduh."); }
    catch (error) { setTemplate(error instanceof Error ? error.message : "Gagal mengunduh template."); }
  };

  const parse = async (file: File) => {
    try {
      setRows(await parseXlsx(file));
      // Auto-scroll ke tabel preview agar langsung terlihat tanpa perlu mencari.
      setTimeout(() => document.getElementById("import-preview-table")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) { setTemplate(error instanceof Error ? error.message : "Gagal membaca spreadsheet."); }
  };

  const execute = async (retryOnly = false) => {
    const work = retryOnly ? rows.filter((row) => row.result === "failed") : selected;
    if (!work.length) return;
    setConfirmOpen(false);
    setExpanded(null);
    setRunning(true);
    setHasBeenSubmittedOnce(true);
    let success = 0;
    let failed = 0;
    try {
      const base = await getJiraBaseUrl();
      // Sequential: satu row tuntas (sukses/gagal) baru lanjut row berikutnya.
      // Setiap row langsung di-update in-place di tabel setelah selesai, tanpa menunggu seluruh batch.
      for (const row of work) {
        setRowResult(row.no, { result: "processing" });
        const patch = await processRow(row, base);
        setRowResult(row.no, { ...patch });
        if (patch.result === "failed") failed++;
        else success++;
      }
      setToast({ message: `Import test case selesai: ${success} Success, ${failed} Failed.`, tone: failed ? "error" : "success" });
      window.setTimeout(() => setToast(null), 6000);
    } finally {
      setRunning(false);
    }
  };

return (
  <div className="space-y-6 font-sans text-ink">
    <Toast message={toast?.message || ""} tone={toast?.tone} />

    {/* MAIN CARD WORKSPACE */}
    <Card className="rounded-3xl border border-slate-200/80 bg-card shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-ink">
          Import Test Case ke Jira Xray
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload spreadsheet, atau tambah Scenario manual, lalu submit.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* TOP ACTION & STATUS BAR */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-indigo-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Action Buttons Left */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              disabled={running}
              className="rounded-full border-slate-200 bg-card px-4 text-xs font-semibold hover:bg-slate-50"
            >
              ⬇ Download Template
            </Button>

            {mode !== "completed" && (
              <label
                className={`cursor-pointer rounded-full bg-brand px-4 py-2 text-xs font-bold text-brand-foreground shadow-sm transition hover:bg-indigo-700 ${
                  running ? "pointer-events-none opacity-45" : ""
                }`}
              >
                ⬆ Upload XLSX
                <input
                  className="sr-only"
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={running}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void parse(file);
                    event.target.value = "";
                  }}
                />
              </label>
            )}

            {mode !== "completed" && (
              <Button
                variant="outline"
                onClick={() => setAddOpen(true)}
                disabled={running}
                className="rounded-full border-brand-soft bg-card text-brand hover:bg-card/80"
              >
                ＋ Add Scenario
              </Button>
            )}

            {template && (
              <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-bold text-slate-600">
                📄 {template}
              </span>
            )}
          </div>

          {/* Status & Submit Right */}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs font-bold text-brand">
              {selected.length} / {rows.length} baris dipilih
            </span>

            <div className="flex items-center gap-2">
              {!running && failedCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => void execute(true)}
                  className="rounded-full border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  Retry Failed ({failedCount})
                </Button>
              )}
              {mode !== "completed" && (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!selected.length || running}
                  className="rounded-full bg-brand px-5 text-xs font-bold text-brand-foreground shadow-sm hover:bg-indigo-700 disabled:opacity-40"
                >
                  Submit Import
                </Button>
              )}
              {mode === "completed" && (
                <Button
                  onClick={startImportBaru}
                  className="rounded-full bg-brand-soft px-5 text-xs font-bold text-brand-foreground hover:bg-brand"
                >
                  ＋ Import Baru
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        {rows.length > 0 && (
          <div className="space-y-4">
            <div
              className="max-h-[500px] overflow-auto rounded-2xl border border-slate-200/80 bg-card shadow-sm"
              id="import-preview-table"
            >
              <table className="min-w-[1200px] w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-indigo-50 shadow-sm">
                  <tr className="text-left text-slate-700">
                    <th className="p-3.5 font-bold">Include</th>
                    <th className="p-3.5 font-bold">No</th>
                    <th className="p-3.5 font-bold">Mode</th>
                    <th className="p-3.5 font-bold">Project</th>
                    <th className="p-3.5 font-bold">Test ID</th>
                    <th className="p-3.5 font-bold">Summary</th>
                    <th className="p-3.5 font-bold">Assignee</th>
                    <th className="p-3.5 font-bold">Repository</th>
                    <th className="p-3.5 font-bold">Test Exec</th>
                    <th className="p-3.5 font-bold">Link Jira</th>
                    <th className="p-3.5 font-bold">Status</th>
                    <th className="p-3.5 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <Fragment key={row.no}>
                      <tr className="transition-colors hover:bg-slate-50/80">
                        <td className="p-3.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-[#FF7A00]"
                            disabled={running || (mode === "completed" && isSuccess(row))}
                            checked={row.selected}
                            onChange={(event) =>
                              update(index, { selected: event.target.checked })
                            }
                          />
                        </td>
                        <td className="p-3.5 font-bold text-slate-700">{row.no}</td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.reuse
                                ? "bg-amber-100 text-amber-700"
                                : "bg-indigo-100 text-brand"
                            }`}
                          >
                            {row.reuse ? "REUSE" : "CREATE NEW"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <LinkCell
                            href={`https://jira.bri.co.id/secure/XrayTestRepositoryAction!default.jspa?entityKey=${encodeURIComponent(
                              row.project
                            )}&path=%5Craven_all_tests`}
                            label={row.project}
                          />
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{row.testId}</td>
                        <td className="max-w-[200px] truncate p-3.5 font-medium text-ink">
                          {row.summary}
                        </td>
                        <td className="p-3.5 text-slate-600">{row.assignee}</td>
                        <td className="p-3.5">
                          <LinkCell
                            href={`https://jira.bri.co.id/secure/XrayTestRepositoryAction!default.jspa?entityKey=${encodeURIComponent(
                              row.project
                            )}&path=${encodeURIComponent(row.repository)}`}
                            label={row.repository}
                          />
                        </td>
                        <td className="p-3.5">
                          <LinkCell
                            href={`https://jira.bri.co.id/browse/${encodeURIComponent(
                              row.testExecution
                            )}`}
                            label={row.testExecution}
                          />
                        </td>
                        <td className="p-3.5">
                          {row.result === "processing" ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-brand">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#FF7A00]" />
                              Loading...
                            </span>
                          ) : row.result === "failed" ? (
                            <span className="font-bold text-red-600">⚠ Error</span>
                          ) : row.jiraKey ? (
                            <LinkCell
                              href={`https://jira.bri.co.id/browse/${encodeURIComponent(
                                row.jiraKey
                              )}`}
                              label={`${row.jiraKey} ↗`}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-3.5">
                          {row.error ? (
                            <Badge variant="destructive">{row.error}</Badge>
                          ) : row.result === "processing" ? (
                            <Badge variant="warning">Processing</Badge>
                          ) : row.result === "failed" ? (
                            <Badge variant="destructive">Failed</Badge>
                          ) : row.result === "created" || row.result === "linked" ? (
                            <Badge variant="success">Uploaded</Badge>
                          ) : (
                            <Badge variant="success">Valid</Badge>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex justify-center gap-1.5">
                            {!(mode === "completed" && isSuccess(row)) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={running}
                                onClick={() => setEdit(index)}
                                className="h-7 rounded-full border-slate-200 px-3 text-[11px]"
                              >
                                Edit
                              </Button>
                            )}
                            {!(mode === "completed" && isSuccess(row)) && (
                              <button
                                disabled={running}
                                className="h-7 rounded-full border border-red-200 px-3 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-45"
                                onClick={() => setDeleteIndex(index)}
                              >
                                Delete
                              </button>
                            )}
                            {(row.result === "failed" ||
                              row.result === "created" ||
                              row.result === "linked") && (
                              <button
                                className={`h-7 rounded-full px-3 text-[10px] font-bold transition ${
                                  expanded === row.no
                                    ? "bg-brand text-brand-foreground"
                                    : "border border-slate-200 bg-card text-slate-600 hover:bg-slate-50"
                                }`}
                                onClick={() =>
                                  setExpanded(expanded === row.no ? null : row.no)
                                }
                              >
                                Detail
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED DETAIL ROW */}
                      {expanded === row.no &&
                        (row.result === "failed" ||
                          row.result === "created" ||
                          row.result === "linked") && (
                          <tr key={`detail-${row.no}`} className="bg-indigo-50/50">
                            <td colSpan={12} className="p-4">
                              <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-card p-4 text-xs shadow-sm">
                                <p>
                                  <strong>Status:</strong>{" "}
                                  <Badge
                                    variant={
                                      row.result === "failed"
                                        ? "destructive"
                                        : "success"
                                    }
                                  >
                                    {row.result}
                                  </Badge>
                                  {row.duration && (
                                    <span className="ml-2 text-slate-500">
                                      (~{row.duration})
                                    </span>
                                  )}
                                </p>
                                {row.statusCode !== undefined && (
                                  <p>
                                    <strong>Status Code:</strong> {row.statusCode}
                                  </p>
                                )}
                                {row.jiraKey && (
                                  <p>
                                    <strong>Jira:</strong>{" "}
                                    <LinkCell
                                      href={`https://jira.bri.co.id/browse/${encodeURIComponent(
                                        row.jiraKey
                                      )}`}
                                      label={row.jiraKey}
                                    />
                                  </p>
                                )}
                                {row.detail && (
                                  <p className="whitespace-pre-wrap">
                                    <strong>Keterangan:</strong> {row.detail}
                                  </p>
                                )}
                                {row.payload && (
                                  <div>
                                    <p className="mb-1">
                                      <strong>Payload yang dikirim:</strong>
                                    </p>
                                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-indigo-50 p-3 font-mono text-[11px] text-slate-800">
                                      {row.payload}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* DIALOGS & POPUPS */}
    <Dialog
      open={confirmOpen}
      title="Konfirmasi Upload"
      onClose={() => setConfirmOpen(false)}
    >
      <p className="text-sm text-slate-700">
        Yakin mau di Upload total: <strong>{selected.length} TC</strong>?
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200"
          onClick={() => setConfirmOpen(false)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-brand text-brand-foreground hover:bg-indigo-700"
          onClick={() => void execute()}
        >
          Yes
        </Button>
      </div>
    </Dialog>

    <Dialog
      open={importBaruOpen}
      title="Import Baru"
      onClose={() => setImportBaruOpen(false)}
    >
      <p className="text-sm text-slate-700">
        Masih ada <strong>{failedCount}</strong> row gagal yang belum di-retry. Lanjutkan
        Import Baru dan buang data ini?
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200"
          onClick={() => setImportBaruOpen(false)}
        >
          Batal
        </Button>
        <Button
          className="rounded-full bg-brand text-brand-foreground hover:bg-indigo-700"
          onClick={() => resetImport()}
        >
          Lanjutkan
        </Button>
      </div>
    </Dialog>

    <Dialog
      open={addOpen}
      title="Add Scenario"
      onClose={() => setAddOpen(false)}
      className="max-w-2xl"
    >
      <EditRow
        row={emptyRow(rows.length + 1)}
        onSave={(patch) =>
          addScenario({ ...emptyRow(rows.length + 1), ...patch })
        }
      />
    </Dialog>

    <Dialog
      open={edit !== null}
      title="Edit Row"
      onClose={() => setEdit(null)}
      className="max-w-2xl"
    >
      {edit !== null && (
        <EditRow
          row={rows[edit]}
          onSave={(patch) => {
            update(edit, patch);
            setEdit(null);
          }}
        />
      )}
    </Dialog>

    <ConfirmDialog
      open={deleteIndex !== null}
      title="Delete scenario?"
      description={
        deleteIndex !== null
          ? `Scenario: ${
              rows[deleteIndex]?.summary || `No. ${rows[deleteIndex]?.no}`
            }`
          : ""
      }
      onClose={() => setDeleteIndex(null)}
      onConfirm={() => {
        if (deleteIndex !== null) removeRow(deleteIndex);
        setDeleteIndex(null);
      }}
    />
  </div>
);
}

function EditRow({ row, onSave }: { row: Row; onSave: (patch: Partial<Row>) => void }) {
  const [draft, setDraft] = useState(row);
  const updateStep = (index: number, patch: Partial<Step>) => setDraft((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) }));
  const wide = new Set(["summary", "description", "repository", "expectedResult"]);
  return <div className="max-h-[70vh] space-y-3 overflow-auto">
    <div className="grid grid-cols-2 gap-2">
      {(["project", "testId", "summary", "description", "assignee", "repository", "expectedResult", "testExecution", "issueLinks", "labels", "jiraExist"] as const).map((key) => (
        <label key={key} className={wide.has(key) ? "col-span-2 block text-xs font-bold" : "block text-xs font-bold"}>{key}<input className="mt-1 h-9 w-full rounded-lg border px-2" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>
      ))}
    </div>
    <label className="flex gap-2 text-xs font-bold"><input type="checkbox" checked={draft.reuse} onChange={(event) => setDraft({ ...draft, reuse: event.target.checked })} /> Reuse existing Jira</label>
    {!draft.reuse && (
      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Manual Test Steps</p>
          <Button variant="outline" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { action: "", data: "", expectedResult: "" }] })}>+ Add Step</Button>
        </div>
        {draft.steps.map((step, index) => (
          <div key={index} className="space-y-1 rounded-lg bg-slate-50 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500">Step {index + 1}</span>
              <button className="text-[10px] font-bold text-red-500 disabled:opacity-40" disabled={draft.steps.length <= 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, stepIndex) => stepIndex !== index) })}>Remove</button>
            </div>
            {(["action", "data", "expectedResult"] as const).map((field) => (
              <textarea key={field} className="h-9 w-full rounded-lg border px-2 py-1 text-xs" placeholder={field} value={step[field]} onChange={(event) => updateStep(index, { [field]: event.target.value })} />
            ))}
          </div>
        ))}
      </div>
    )}
    <Button onClick={() => onSave(draft)}>Save</Button>
  </div>;
}
