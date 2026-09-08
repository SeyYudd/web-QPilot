import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusDialog } from "@/components/ui/StatusDialog";
import { requestApi, fieldClass } from "@/components/features/shared";
import type { Draft, DraftFields, TestCase } from "@/components/features/shared";
import { buildFullStorageHtml } from "@/lib/sit-template";
import { getConfluenceBaseUrl } from "@/lib/auth/session";
import { cleanStepNumber, loadTestCases } from "./loadTestCases";


export default function CreateSitPageView() {
  const [form, setForm] = useState({
    spaceKey: "",
    parentPageId: "",
    executionKey: "",
    sitPageName: "",
  });
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const showStatus = (message: string, tone: "info" | "success" | "error" = "success") => { setStatusTone(tone); setStatus(message); };
  const [editor, setEditor] = useState<{
    index: number | null;
    draft: Draft;
  } | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [successLink, setSuccessLink] = useState("");
  const [loadingCases, setLoadingCases] = useState(false);
  const [dragStepIndex, setDragStepIndex] = useState<number | null>(null);
  const [dragCaseIndex, setDragCaseIndex] = useState<number | null>(null);
  const [duplicateName, setDuplicateName] = useState(false);
  const [sitDisplayMode, setSitDisplayMode] = useState<"expand" | "table">("expand");
  const updateForm = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const fetchCases = async () => {
    setLoadingCases(true);
    try {
      const result = await loadTestCases(
        form.executionKey.trim().toUpperCase(),
      );
      setTestCases(
        result.testCases.map((item, index) => ({ ...item, no: index + 1 })),
      );
      setForm((current) => ({
        ...current,
        sitPageName:
          current.sitPageName.trim() ||
          `${form.executionKey.trim().toUpperCase()} SIT ${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getFullYear()).slice(-2)}`,
      }));
       showStatus(`${result.testCases.length} Test Case berhasil dimuat.`);
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Gagal mengambil Test Case.",
        "error",
      );
    } finally {
      setLoadingCases(false);
    }
  };
  const downloadSample = () => {
    if (!testCases.length) {
      showStatus("Load Test Case terlebih dahulu sebelum download sample.", "info");
      return;
    }
    const rows = [
      ["No", "Scenario", "Function", "Steps", "Data", "Expected Result"],
      ...testCases.map((item) => [
        item.no,
        item.scenario,
        item.function,
        item.steps,
        item.data,
        item.expectedResult,
      ]),
    ];
    if (window.XLSX) {
      const sheet = window.XLSX.utils.aoa_to_sheet(rows);
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, sheet, "SIT Template");
      window.XLSX.writeFile(
        workbook,
        `${form.executionKey.trim().toUpperCase()} - SIT Sample.xlsx`,
      );
    } else {
      const csv = rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      link.download = `${form.executionKey.trim().toUpperCase()} - SIT Sample.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
    showStatus("Sample berhasil diunduh.");
  };
  const saveDraft = () => {
    if (
      !editor ||
      !editor.draft.key.trim() ||
      !editor.draft.scenario.trim() ||
      !editor.draft.function.trim() ||
      !editor.draft.stepRows.length
    )
      return;
    const stepRows = editor.draft.stepRows.map((step) => ({
      action: cleanStepNumber(step.action),
      data: step.data,
      expectedResult: step.expectedResult,
    }));
    setTestCases((current) => {
      if (editor.index === null)
        return [
          ...current,
          {
            ...editor.draft,
            steps: stepRows.map((step) => step.action).join("\n"),
            data: stepRows.map((step) => step.data).join("\n"),
            expectedResult: stepRows
              .map((step) => step.expectedResult)
              .join("\n"),
            stepRows,
            no: current.length + 1,
          },
        ];
      return current.map((item, index) =>
        index === editor.index
          ? {
              ...item,
              ...editor.draft,
              steps: stepRows.map((step) => step.action).join("\n"),
              data: stepRows.map((step) => step.data).join("\n"),
              expectedResult: stepRows
                .map((step) => step.expectedResult)
                .join("\n"),
              stepRows,
            }
          : item,
      );
    });
    setEditor(null);
  };
  const openEditor = (index: number | null) => {
    const item = index === null ? null : testCases[index];
    const rows = item?.stepRows || [
      {
        action: item?.steps || "",
        data: item?.data || "",
        expectedResult: item?.expectedResult || "",
      },
    ];
    setEditor({
      index,
      draft: {
        key: item?.key || "",
        scenario: item?.scenario || "",
        function: item?.function || "",
        steps: item?.steps || "",
        data: item?.data || "",
        expectedResult: item?.expectedResult || "",
        stepRows: rows.map((row) => ({ ...row })),
      },
    });
  };
  const moveStep = (from: number, to: number) => {
    if (!editor || to < 0 || to >= editor.draft.stepRows.length) return;
    const rows = [...editor.draft.stepRows];
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    setEditor({ ...editor, draft: { ...editor.draft, stepRows: rows } });
  };
  const removeCase = () => {
    if (removeIndex === null) return;
    setTestCases((current) =>
      current
        .filter((_, index) => index !== removeIndex)
        .map((item, index) => ({ ...item, no: index + 1 })),
    );
    setRemoveIndex(null);
  };
  const moveCase = (from: number, to: number) => {
    if (from === to || to < 0 || to >= testCases.length) return;
    setTestCases((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next.map((entry, index) => ({ ...entry, no: index + 1 }));
    });
  };
  const generate = async () => {
    if (
      !form.spaceKey.trim() ||
      !form.parentPageId.trim() ||
      !form.executionKey.trim() ||
      !testCases.length ||
      testCases.some(
        (item) =>
          !item.key.trim() || !item.scenario.trim() || !item.function.trim(),
      )
    ) {
      setConfirmGenerate(false);
      showStatus("Semua field utama wajib diisi sebelum Generate SIT Page.", "info");
      return;
    }
    setConfirmGenerate(false);
    setProgress(8);
    try {
      const confBase = await getConfluenceBaseUrl();
      setProgress(25);
      await requestApi(
        `${confBase}/rest/api/content/${encodeURIComponent(form.parentPageId)}?expand=version,ancestors`,
      );
      setProgress(45);
      const children = await requestApi(
        `${confBase}/rest/api/content/${encodeURIComponent(form.parentPageId)}/child/page?limit=200`,
      );
      const now = new Date();
      const mmyy = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(-2)}`;
      const title =
        form.sitPageName.trim() ||
        `${form.executionKey.trim().toUpperCase()} SIT ${mmyy}`;
      const payload: {
        type: string;
        title: string;
        space: { key: string };
        ancestors: Array<{ id: string }>;
        body: { storage: { value: string; representation: string } };
      } = {
        type: "page",
        title,
        space: { key: form.spaceKey.trim().toUpperCase() },
        ancestors: [{ id: form.parentPageId.trim() }],
        body: {
          storage: {
            value: buildFullStorageHtml(
              title,
              testCases.map((item) => ({
                ...item,
                functionName: item.function,
                steps: item.stepRows || [
                  {
                    action: item.steps,
                    data: item.data,
                    expectedResult: item.expectedResult,
                  },
                ],
              })),
              sitDisplayMode,
            ),
            representation: "storage",
          },
        },
      };
      const existing = (children.results || []).find(
        (page: { title: string }) => page.title === title,
      );
      setProgress(65);
      if (existing) {
        setDuplicateName(true);
        setProgress(null);
        return;
      }
      setProgress(80);
      const saved = await requestApi(`${confBase}/rest/api/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setProgress(100);
       showStatus("SIT Page berhasil dibuat. Menyiapkan link Confluence...");
      setSuccessLink(`${confBase}/pages/viewpage.action?pageId=${saved.id}`);
    } catch (error) {
      setProgress(null);
      showStatus(error instanceof Error ? error.message : "Generate SIT gagal.", "error");
    }
  };
  const draftField = (
    key: keyof DraftFields,
    label: string,
    disabled = false,
  ) => (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <input
        className={`${fieldClass} ${disabled ? "bg-slate-100 text-slate-500" : ""}`}
        disabled={disabled}
        value={editor?.draft[key] || ""}
        onChange={(event) =>
          editor &&
          setEditor({
            ...editor,
            draft: { ...editor.draft, [key]: event.target.value },
          })
        }
      />
    </label>
  );
return (
  <div className="grid gap-6 text-ink lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
    {/* LEFT SIDE: CONTROLLER PANEL */}
    <section className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-card p-6 shadow-sm">
      <div className="space-y-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
            Page Generator Controller
          </span>
          <h2 className="text-xl font-bold text-ink">Create SIT Page</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Create Confluence SIT Document from Jira TE
          </p>
        </div>

        <div className="space-y-3.5">
          <label className="block text-xs font-bold text-slate-700">
            Space Key Confluence
            <input
              className={`${fieldClass} mt-1 rounded-2xl border-slate-200 focus:border-brand`}
              value={form.spaceKey}
              onChange={(event) => updateForm("spaceKey", event.target.value)}
              placeholder="SQACPA"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Parent Page ID
            <input
              className={`${fieldClass} mt-1 rounded-2xl border-slate-200 focus:border-brand`}
              value={form.parentPageId}
              onChange={(event) =>
                updateForm("parentPageId", event.target.value)
              }
              placeholder="6597588"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Jira Test Execution Key
            <input
              className={`${fieldClass} mt-1 rounded-2xl border-slate-200 uppercase focus:border-brand`}
              value={form.executionKey}
              onChange={(event) =>
                updateForm("executionKey", event.target.value)
              }
              placeholder="OCOCWRAOUF-152"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            SIT Page Name
            <input
              className={`${fieldClass} mt-1 rounded-2xl border-slate-200 focus:border-brand`}
              value={form.sitPageName}
              onChange={(event) =>
                updateForm("sitPageName", event.target.value)
              }
              placeholder="Generate dari Jira TE dan periode saat ini"
            />
          </label>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="mt-6 flex flex-col gap-2 pt-2">
        <Button
          variant="outline"
          onClick={fetchCases}
          disabled={loadingCases || !form.executionKey.trim()}
          className="w-full rounded-2xl border-slate-200 text-xs font-bold hover:bg-indigo-50 hover:text-brand"
        >
          {loadingCases ? "Loading Test Case..." : "🔍 Load Test Cases"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={downloadSample}
            disabled={!testCases.length}
            className="rounded-2xl border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
          >
            📥 Sample
          </Button>
          <Button
            onClick={() => setConfirmGenerate(true)}
            disabled={!testCases.length}
            className="rounded-2xl bg-brand text-xs font-bold text-brand-foreground hover:bg-indigo-700 disabled:opacity-40"
          >
            🚀 Generate
          </Button>
        </div>
      </div>
    </section>

    {/* RIGHT SIDE: SUMMARY & TABLE */}
    <section className="flex min-w-0 flex-col rounded-3xl border border-slate-200/80 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
            Generation Summary
          </span>
          <h2 className="text-xl font-bold text-ink">
            Generation Summary &amp; Status
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Coverage, editable test cases, and generation status.
          </p>
        </div>

        {/* STATUS BADGES */}
        <div className="flex gap-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total TC
            </p>
            <p className="text-lg font-bold text-slate-800">
              {testCases.length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Status
            </p>
            <p className="text-lg font-bold text-emerald-700">
              {testCases.length ? "Ready" : "Empty"}
            </p>
          </div>
        </div>
      </div>

      {/* DISPLAY MODE SWITCHER & ADD BUTTON */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-bold text-slate-700">Tampilan SIT Page</p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setSitDisplayMode("expand")}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                sitDisplayMode === "expand"
                  ? "border-brand bg-indigo-50 text-brand"
                  : "border-slate-200 bg-card text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>▾</span> Expand
            </button>
            <button
              type="button"
              onClick={() => setSitDisplayMode("table")}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                sitDisplayMode === "table"
                  ? "border-brand bg-indigo-50 text-brand"
                  : "border-slate-200 bg-card text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>▤</span> Without Expand
            </button>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => openEditor(null)}
          disabled={!testCases.length}
          className="rounded-xl border-slate-200 px-4 text-xs font-bold text-brand hover:bg-indigo-50 disabled:opacity-40"
        >
          ＋ Add Manual TC
        </Button>
      </div>

      {/* TEST CASES TABLE */}
      <div className="mt-4 max-h-[520px] flex-1 overflow-auto rounded-2xl border border-slate-200/80 shadow-sm">
        <Table className="min-w-[800px] text-xs">
          <TableHeader className="sticky top-0 z-10 bg-indigo-50">
            <TableRow className="border-b border-slate-200/80 text-slate-700">
              <TableHead className="w-12 font-bold text-slate-700">NO</TableHead>
              <TableHead className="font-bold text-slate-700">JIRA TICKET</TableHead>
              <TableHead className="min-w-40 font-bold text-slate-700">SCENARIO</TableHead>
              <TableHead className="font-bold text-slate-700">FUNCTION</TableHead>
              <TableHead className="font-bold text-slate-700">STEPS</TableHead>
              <TableHead className="font-bold text-slate-700">DATA</TableHead>
              <TableHead className="font-bold text-slate-700">EXPECTED RESULT</TableHead>
              <TableHead className="text-right font-bold text-slate-700">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {testCases.length ? (
              testCases.map((item, index) => (
                <TableRow
                  key={`${item.key || item.scenario}-${index}`}
                  draggable
                  onDragStart={() => setDragCaseIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragCaseIndex !== null) moveCase(dragCaseIndex, index);
                    setDragCaseIndex(null);
                  }}
                  className="cursor-grab border-b border-slate-100 hover:bg-slate-50/80 active:cursor-grabbing"
                >
                  <TableCell className="font-medium text-slate-500">{item.no}</TableCell>
                  <TableCell className="font-bold text-brand">{item.key}</TableCell>
                  <TableCell className="min-w-40 font-semibold text-slate-800">
                    {item.scenario}
                  </TableCell>
                  <TableCell className="text-slate-600">{item.function}</TableCell>
                  <TableCell className="max-w-[200px] whitespace-pre-line text-slate-600">
                    {item.steps || "-"}
                  </TableCell>
                  <TableCell className="max-w-[150px] whitespace-pre-line text-slate-600">
                    {item.data || "-"}
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-pre-line text-slate-600">
                    {item.expectedResult || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 text-xs font-bold">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => openEditor(index)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => setRemoveIndex(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-16 text-center text-xs text-slate-400"
                >
                  Load Jira Test Execution untuk menampilkan Test Case.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>

    {/* EDIT / ADD MANUAL TEST CASE DIALOG */}
    <Dialog
      open={Boolean(editor)}
      title={
        editor?.index === null ? "Add Manual Test Case" : "Edit Test Case"
      }
      preventClose
      className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl"
    >
      {editor && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {draftField("key", "Jira Ticket")}
            {draftField("function", "Function / Feature")}
          </div>
          {draftField("scenario", "Scenario Name")}

          <div>
            <p className="mb-2 text-xs font-bold text-slate-700">
              Steps / Test Data / Expected Result
            </p>
            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {editor.draft.stepRows.map((step, index) => (
                <div
                  key={`step-${index}`}
                  draggable
                  onDragStart={() => setDragStepIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragStepIndex !== null) moveStep(dragStepIndex, index);
                    setDragStepIndex(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="cursor-grab text-xs font-bold text-slate-500">
                      ☷ Step {index + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-card px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() => moveStep(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-card px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() => moveStep(index, index + 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      className={`${fieldClass} min-h-16 resize-y rounded-xl border-slate-200 bg-card text-xs`}
                      rows={2}
                      placeholder="Steps action..."
                      value={step.action}
                      onChange={(event) => {
                        const rows = [...editor.draft.stepRows];
                        rows[index] = {
                          ...rows[index],
                          action: event.target.value,
                        };
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, stepRows: rows },
                        });
                      }}
                    />
                    <textarea
                      className={`${fieldClass} min-h-16 resize-y rounded-xl border-slate-200 bg-card text-xs`}
                      rows={2}
                      placeholder="Test Data..."
                      value={step.data}
                      onChange={(event) => {
                        const rows = [...editor.draft.stepRows];
                        rows[index] = {
                          ...rows[index],
                          data: event.target.value,
                        };
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, stepRows: rows },
                        });
                      }}
                    />
                    <textarea
                      className={`${fieldClass} min-h-16 resize-y rounded-xl border-slate-200 bg-card text-xs`}
                      rows={2}
                      placeholder="Expected Result..."
                      value={step.expectedResult}
                      onChange={(event) => {
                        const rows = [...editor.draft.stepRows];
                        rows[index] = {
                          ...rows[index],
                          expectedResult: event.target.value,
                        };
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, stepRows: rows },
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-full border-slate-200 text-xs font-bold"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-brand px-5 text-xs font-bold text-brand-foreground hover:bg-indigo-700"
              onClick={saveDraft}
              disabled={
                !editor.draft.key.trim() ||
                !editor.draft.scenario.trim() ||
                !editor.draft.function.trim() ||
                !editor.draft.stepRows.length
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Dialog>

    {/* LOADING TEST CASES DIALOG */}
    <Dialog open={loadingCases} title="Loading Test Cases" preventClose>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF7A00]" />
        <p className="text-xs font-semibold text-slate-600">
          Sedang mengambil data Jira Test Execution...
        </p>
      </div>
    </Dialog>

    {/* DELETE SCENARIO CONFIRMATION */}
    <Dialog
      open={removeIndex !== null}
      title="Delete Scenario?"
      preventClose
    >
      <p className="text-xs text-slate-600">
        {removeIndex !== null
          ? `Apakah kamu yakin ingin menghapus scenario: "${testCases[removeIndex]?.scenario}"?`
          : ""}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200 text-xs font-bold"
          onClick={() => setRemoveIndex(null)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-red-600 text-xs font-bold text-white hover:bg-red-700"
          onClick={removeCase}
        >
          Yes, Remove
        </Button>
      </div>
    </Dialog>

    {/* GENERATE SIT PAGE CONFIRMATION */}
    <Dialog
      open={confirmGenerate}
      title="Generate SIT Page?"
      preventClose
    >
      <p className="text-xs text-slate-600">
        Total Test Cases yang akan di-generate:{" "}
        <strong className="text-brand">{testCases.length} scenario</strong>.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200 text-xs font-bold"
          onClick={() => setConfirmGenerate(false)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-brand px-5 text-xs font-bold text-brand-foreground hover:bg-indigo-700"
          onClick={generate}
        >
          Yes, Generate Now
        </Button>
      </div>
    </Dialog>

    {/* DUPLICATE NAME DIALOG */}
    <Dialog open={duplicateName} title="SIT Page Already Exists" preventClose>
      <p className="text-xs text-red-600">
        Nama halaman ini sudah ada di Confluence. Silakan ubah SIT Page Name di panel sebelah kiri.
      </p>
      <div className="mt-6 flex justify-end">
        <Button
          className="rounded-full bg-brand text-xs font-bold text-brand-foreground hover:bg-indigo-700"
          onClick={() => setDuplicateName(false)}
        >
          Change SIT Page Name
        </Button>
      </div>
    </Dialog>

    {/* GENERATION PROGRESS DIALOG */}
    <Dialog
      open={progress !== null && !successLink}
      title="Generating SIT Page..."
      preventClose
    >
      <div className="space-y-4 py-2">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${progress || 0}%` }}
          />
        </div>
        <p className="text-center text-xs font-semibold text-slate-600">
          Loading... sebentar ya, SIT Page kamu lagi disiapin ({progress || 0}%)
        </p>
      </div>
    </Dialog>

    {/* SUCCESS DIALOG */}
    <Dialog
      open={Boolean(successLink)}
      title="🎉 Success Create SIT PAGE!"
      preventClose
    >
      <p className="text-xs text-slate-600">
        Halaman SIT Confluence berhasil dibuat dan disinkronisasi.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200 text-xs font-bold"
          onClick={() => {
            setSuccessLink("");
            setProgress(null);
            setTestCases([]);
          }}
        >
          Close
        </Button>

        <Button
          className="rounded-full bg-brand text-xs font-bold text-brand-foreground hover:bg-indigo-700"
          onClick={() => window.open(successLink, "_blank")}
        >
          Open Confluence Page ↗
        </Button>
      </div>
    </Dialog>

    <StatusDialog
      message={status}
      tone={statusTone}
      onClose={() => setStatus("")}
    />
  </div>
);
}
