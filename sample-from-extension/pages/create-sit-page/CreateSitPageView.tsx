import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { StatusDialog } from "../../components/dashboard/StatusDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { getConfluenceBaseUrl, requestApi } from "../../lib/api-request";
import {
  cleanStepNumber,
  loadTestCases,
  type StepRow,
  type TestCase,
} from "./lib/test-cases";

const fieldClass =
  "mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

type DraftFields = Pick<
  TestCase,
  "key" | "scenario" | "function" | "steps" | "data" | "expectedResult"
>;
type Draft = DraftFields & { stepRows: StepRow[] };

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
      const stored = await chrome.storage.local.get(["confUrl"]);
      const confBase = String(stored.confUrl || "").replace(/\/$/, "");
      if (!confBase) throw new Error("URL Confluence belum dikonfigurasi.");
      setProgress(25);
      const parent = await requestApi(
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
      const payload: any = {
        type: "page",
        title,
        space: { key: form.spaceKey.trim().toUpperCase() },
        ancestors: [{ id: form.parentPageId.trim() }],
        body: {
          storage: {
            value:
              window.QPilotSitTemplateBuilder?.buildFullStorageHtml(
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
              ) || "",
            representation: "storage",
          },
        },
      };
      const existing = (children.results || []).find(
        (page: any) => page.title === title,
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
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          PAGE GENERATOR CONTROLLER
        </p>
        <h2 className="mt-2 text-2xl font-serif font-medium text-slate-900">
          Create SIT Page
        </h2>
        <p className="mb-6 mt-2 text-sm text-slate-500">
          Create Confluence SIT Document
        </p>
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-600">
            Space Key Confluence
            <input
              className={fieldClass}
              value={form.spaceKey}
              onChange={(event) => updateForm("spaceKey", event.target.value)}
              placeholder="SQACPA"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Parent Page ID
            <input
              className={fieldClass}
              value={form.parentPageId}
              onChange={(event) =>
                updateForm("parentPageId", event.target.value)
              }
              placeholder="6597588"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Jira Test Execution Key
            <input
              className={`${fieldClass} uppercase`}
              value={form.executionKey}
              onChange={(event) =>
                updateForm("executionKey", event.target.value)
              }
              placeholder="OCOCWRAOUF-152"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            SIT PAGE NAME
            <input
              className={fieldClass}
              value={form.sitPageName}
              onChange={(event) =>
                updateForm("sitPageName", event.target.value)
              }
              placeholder="Generate dari Jira TE dan periode saat ini"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
           <Button
            variant="outline"
            onClick={fetchCases}
            disabled={loadingCases || !form.executionKey.trim()}
          >
            {loadingCases ? "Loading Test Case..." : "Load Test Cases"}
          </Button>
          <Button
            variant="outline"
            onClick={downloadSample}
            disabled={!testCases.length}
          >
            Download + Sample
          </Button>
          <Button
            onClick={() => setConfirmGenerate(true)}
            disabled={!testCases.length}
           >
             Generate SIT PAGE
           </Button>
         </div>
      </section>
      <section className="min-w-0 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              GENERATION SUMMARY
            </p>
            <h2 className="mt-2 text-2xl font-serif font-medium text-slate-900">
              Generation Summary &amp; Status
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Coverage, editable test cases, and generation status.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Coverage TC
              </p>
              <p className="mt-1 text-xl font-bold text-slate-700">
                {testCases.length}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Status
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {testCases.length ? "Ready" : "Empty"}
              </p>
            </div>
          </div>
        </div>
         <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
           <div>
             <p className="text-xs font-bold text-slate-600">Tampilan SIT Page</p>
             <div className="mt-2 flex gap-2">
               <button type="button" onClick={() => setSitDisplayMode("expand")} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${sitDisplayMode === "expand" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>
                 <span className="mb-1 block text-left text-lg leading-none">▾</span>Expand
               </button>
               <button type="button" onClick={() => setSitDisplayMode("table")} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${sitDisplayMode === "table" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>
                 <span className="mb-1 block text-left text-lg leading-none">▤</span>Without Expand
               </button>
             </div>
           </div>
           <Button
            variant="outline"
            onClick={() => openEditor(null)}
            disabled={!testCases.length}
          >
            ＋ Add Manual TC
          </Button>
        </div>
        <div className="mt-4 max-h-[560px] overflow-auto rounded-2xl border border-slate-100">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>NO</TableHead>
                <TableHead>JIRA TICKET</TableHead>
                <TableHead>SCENARIO</TableHead>
                <TableHead>FUNCTION</TableHead>
                <TableHead>STEPS</TableHead>
                <TableHead>DATA</TableHead>
                <TableHead>EXPECTED RESULT</TableHead>
                <TableHead>ACTION</TableHead>
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
                      if (dragCaseIndex !== null)
                        moveCase(dragCaseIndex, index);
                      setDragCaseIndex(null);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <TableCell>{item.no}</TableCell>
                    <TableCell className="font-semibold">{item.key}</TableCell>
                    <TableCell className="min-w-40 font-semibold">
                      {item.scenario}
                    </TableCell>
                    <TableCell>{item.function}</TableCell>
                    <TableCell className="whitespace-pre-line">
                      {item.steps || "-"}
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {item.data || "-"}
                    </TableCell>
                    <TableCell className="whitespace-pre-line">
                      {item.expectedResult || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          className="font-bold text-blue-600 hover:underline"
                          onClick={() => openEditor(index)}
                        >
                          Edit
                        </button>
                        <button
                          className="font-bold text-red-600 hover:underline"
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
                    className="py-14 text-center text-sm text-slate-400"
                  >
                    Load Jira Test Execution untuk menampilkan Test Case.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      <Dialog
        open={Boolean(editor)}
        title={
          editor?.index === null ? "Add Manual Test Case" : "Edit Test Case"
        }
        preventClose
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {editor && (
          <div className="space-y-4">
            {draftField("key", "Jira Ticket")}
            {draftField("function", "Function / Feature")}
            {draftField("scenario", "Scenario Name")}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">
                Steps / Test Data / Expected Result
              </p>
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {editor.draft.stepRows.map((step, index) => (
                  <div
                    key={`step-${index}`}
                    draggable
                    onDragStart={() => setDragStepIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragStepIndex !== null)
                        moveStep(dragStepIndex, index);
                      setDragStepIndex(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="cursor-grab text-xs font-bold text-slate-400">
                        ☷ Step {index + 1}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded px-2 text-xs text-slate-500 hover:bg-white"
                          onClick={() => moveStep(index, index - 1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 text-xs text-slate-500 hover:bg-white"
                          onClick={() => moveStep(index, index + 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <textarea
                        className={`${fieldClass} min-h-20 resize-y whitespace-pre-wrap py-2`}
                        rows={3}
                        placeholder="Steps"
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
                        className={`${fieldClass} min-h-20 resize-y whitespace-pre-wrap py-2`}
                        rows={3}
                        placeholder="Test Data"
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
                        className={`${fieldClass} min-h-20 resize-y whitespace-pre-wrap py-2`}
                        rows={3}
                        placeholder="Expected Result"
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
              <Button variant="outline" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button
                onClick={saveDraft}
                disabled={
                  !editor.draft.key.trim() ||
                  !editor.draft.scenario.trim() ||
                  !editor.draft.function.trim() ||
                  !editor.draft.stepRows.length
                }
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={loadingCases} title="Loading Test Cases" preventClose>
        <div className="space-y-4">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-center text-sm text-slate-500">
            Sedang mengambil data Jira Test Execution...
          </p>
        </div>
      </Dialog>
      <Dialog
        open={removeIndex !== null}
        title="Are you sure want to delete scenario?"
        preventClose
      >
        <p className="text-sm text-slate-500">
          {removeIndex !== null
            ? `Scenario: ${testCases[removeIndex]?.scenario}`
            : ""}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveIndex(null)}>
            Cancel
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={removeCase}>
            Yes, Remove
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmGenerate}
        title="Are you sure want to Generate SIT Page?"
        preventClose
      >
        <p className="text-sm text-slate-500">
          Total Test Cases to generate: <strong>{testCases.length}</strong>
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmGenerate(false)}>
            Cancel
          </Button>
          <Button onClick={generate}>Yes, Generate</Button>
        </div>
      </Dialog>
      <Dialog open={duplicateName} title="SIT Page Already Exists" preventClose>
        <p className="text-sm text-red-600">
          There exists a page with this name. Please change the SIT Page Name.
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setDuplicateName(false)}>
            Change SIT Page Name
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={progress !== null && !successLink}
        title="Generating SIT Page"
        preventClose
      >
        <div className="space-y-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
          <p className="text-center text-sm font-semibold text-slate-600">
            Loading... sebentar yah SIT Page Kamu lagi Mimin bikinin (
            {progress || 0}%)
          </p>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(successLink)}
        title="🎉 Success Create SIT PAGE!"
        preventClose
      >
        <p className="text-sm text-slate-500">
          Halaman SIT Confluence berhasil dibuat dan disinkronisasi.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSuccessLink("");
              setProgress(null);
              setTestCases([]);
            }}
          >
            Close
          </Button>
          <Button onClick={() => window.open(successLink, "_blank")}>
            Show Link
          </Button>
        </div>
      </Dialog>
      <StatusDialog message={status} tone={statusTone} onClose={() => setStatus("")} />
    </div>
  );
}
