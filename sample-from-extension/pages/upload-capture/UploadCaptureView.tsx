import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { StatusDialog } from "../../components/dashboard/StatusDialog";
import { getConfluenceBaseUrl, requestApi } from "../../lib/api-request";
import {
  dataUrlToBlob,
  parseScenarios,
  updateConfluenceExpand,
} from "./lib/sections";

const fieldClass =
  "mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function UploadCaptureView({ editedImages = {} }: { editedImages?: Record<string, string> }) {
  type ExpandSection = { id: string; title: string };
  type ScenarioTree = {
    scenarioId: string;
    scenarioTitle: string;
    scenarioIndex: number;
    expandSections: ExpandSection[];
  };
  type Preview = {
    id: string;
    file: File;
    url: string;
    name: string;
    size: number;
    caption: string;
  };
  const [pageId, setPageId] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioTree[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [selectedExpandId, setSelectedExpandId] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sectionEditor, setSectionEditor] = useState<{
    id: string | null;
    title: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [uploadOperationId, setUploadOperationId] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const showStatus = (message: string, tone: "info" | "success" | "error" = "success") => { setStatusTone(tone); setStatus(message); };
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [viewPreview, setViewPreview] = useState<Preview | null>(null);
  const makePreview = (file: File): Preview => ({
    id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name,
    size: file.size, caption: "",
  });
  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      /image\/(png|jpe?g|webp)/i.test(file.type),
    );
    setPreviews((current) => [
      ...current,
      ...files.map(makePreview),
    ]);
    event.target.value = "";
  };
  useEffect(() => {
    const listener = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
      const file = image?.getAsFile();
      if (file) { event.preventDefault(); setPreviews((current) => [...current, makePreview(new File([file], `${Date.now()}.png`, { type: file.type }))]); }
    };
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);
  const openEditor = (preview: Preview) => {
    const editor = window.open(`${location.pathname}${location.search}#image-editor`, "_blank");
    if (!editor) return;
    const send = () => editor.postMessage({ type: "qpilot-image-edit-source", sessionId: preview.id, dataUrl: preview.url, name: preview.name }, window.location.origin);
    const timer = window.setInterval(() => { if (editor.closed) window.clearInterval(timer); else send(); }, 250);
    window.setTimeout(() => window.clearInterval(timer), 5000);
  };
  const selectedScenario = scenarios.find(
    (item) => item.scenarioId === selectedScenarioId,
  );
  const selectedSection = selectedScenario?.expandSections.find(
    (item) => item.id === selectedExpandId,
  );
  useEffect(() => {
    if (!uploadOperationId) return;
    const listener = (changes: { sitUploadState?: { newValue?: any } }) => {
      const state = changes.sitUploadState?.newValue;
      if (!state || state.operationId !== uploadOperationId) return;
      const total = state.files?.length || 0;
      const completed = (state.successCount || 0) + (state.failCount || 0);
      setUploadProgress(total ? Math.round((completed / total) * 100) : 0);
      if (!state.isActive) {
        const success = state.successCount || 0;
        const failed = state.failCount || 0;
        setUploading(false);
        setUploadOperationId("");
        if (failed)
           showStatus(
             `Upload selesai dengan masalah. Sukses: ${success}/${total}, Gagal: ${failed}.`,
             "error",
           );
         else
           showStatus(
             `Screenshots uploaded successfully! ${success} file berhasil di-upload.`,
           );
        previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        setPreviews([]);
       }
    };
    (chrome.storage as any).onChanged.addListener(listener);
    return () => (chrome.storage as any).onChanged.removeListener(listener);
  }, [uploadOperationId]);
  const fetchSections = async () => {
    if (!pageId.trim())
      return showStatus("Isi Confluence Page ID terlebih dahulu.", "info");
    setLoadingPage(true);
    try {
      const stored = await chrome.storage.local.get(["confUrl"]);
      const base = String(stored.confUrl || "").replace(/\/$/, "");
      const page = await requestApi(
        `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}?expand=body.storage`,
      );
      const found = parseScenarios(
        page.body?.storage?.value || "",
      );
      const unique = found.filter(
        (item, index, list) =>
          list.findIndex(
            (candidate) => candidate.scenarioId === item.scenarioId,
          ) === index,
      );
      setScenarios(unique);
      const first = unique[0];
      setSelectedScenarioId(first?.scenarioId || "");
      setSelectedExpandId("");
       showStatus(
        `${unique.length} Scenario dan ${unique.reduce((count, item) => count + item.expandSections.length, 0)} Expand Section berhasil dimuat.`,
      );
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Gagal mengambil struktur Scenario.",
        "error",
      );
    } finally {
      setLoadingPage(false);
    }
  };
  const saveSection = async () => {
    if (!sectionEditor?.title.trim() || !selectedScenario) return;
    try {
      await updateConfluenceExpand(
        await getConfluenceBaseUrl(),
        pageId.trim(),
        selectedScenario.scenarioId,
        sectionEditor.id ? "edit" : "add",
        selectedSection?.title || "",
        sectionEditor.title.trim(),
      );
      const scenarioId = selectedScenario.scenarioId;
      const newId = `local-${Date.now()}`;
      setScenarios((current) =>
        current.map((scenario) => {
          if (scenario.scenarioId !== scenarioId) return scenario;
          if (sectionEditor.id)
            return {
              ...scenario,
              expandSections: scenario.expandSections.map((item) =>
                item.id === sectionEditor.id
                  ? { ...item, title: sectionEditor.title.trim() }
                  : item,
              ),
            };
          const item = { id: newId, title: sectionEditor.title.trim() };
          return {
            ...scenario,
            expandSections: [...scenario.expandSections, item],
          };
        }),
      );
      if (!sectionEditor.id) setSelectedExpandId(newId);
      setSectionEditor(null);
       showStatus("Expand Section berhasil disimpan ke Confluence.");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan Expand Section.",
        "error",
      );
    }
  };
  const removeSection = async () => {
    if (!deleteId || !selectedSection || !selectedScenario) return;
    try {
      await updateConfluenceExpand(
        await getConfluenceBaseUrl(),
        pageId.trim(),
        selectedScenario.scenarioId,
        "delete",
        selectedSection.title,
      );
      const [scenarioId, expandId] = deleteId.split("::");
      setScenarios((current) =>
        current.map((scenario) =>
          scenario.scenarioId === scenarioId
            ? {
                ...scenario,
                expandSections: scenario.expandSections.filter(
                  (item) => item.id !== expandId,
                ),
              }
            : scenario,
        ),
      );
      if (selectedScenarioId === scenarioId && selectedExpandId === expandId) {
        setSelectedExpandId("");
      }
      setDeleteId(null);
       showStatus("Expand Section berhasil dihapus dari Confluence.");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Gagal menghapus Expand Section.",
        "error",
      );
    }
  };
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= previews.length) return;
    setPreviews((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const upload = async () => {
    if (
      !previews.length ||
      !pageId.trim() ||
      !selectedScenarioId ||
      !selectedExpandId
    )
      return;
    setUploading(true);
    setUploadProgress(0);
     setStatus("");
    try {
      if (!window.qpilotBlobStore)
        throw new Error("Blob store belum tersedia.");
      const files: Array<Record<string, unknown>> = [];
      for (const preview of previews) {
        const editedUrl = editedImages[preview.id];
        const uploadBlob = editedUrl ? dataUrlToBlob(editedUrl) : preview.file;
        const blobKey = await window.qpilotBlobStore.put(uploadBlob);
        files.push({
          name: preview.name,
          size: uploadBlob.size,
          caption: preview.caption,
          isDrive: false,
          blobKey,
          status: "pending",
          attempts: 0,
        });
      }
      const operationId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setUploadOperationId(operationId);
      await new Promise<void>((resolve) =>
        (chrome.storage.local as any).set(
          {
            sitUploadState: {
              operationId,
              isActive: true,
              pageId: pageId.trim(),
              targetScenario: String(selectedScenario?.scenarioIndex || ""),
              targetScenarioText:
                selectedScenario?.scenarioTitle || selectedScenarioId,
              targetExpand: selectedSection?.title || "Screen Capture",
              currentIndex: 0,
              successCount: 0,
              failCount: 0,
              files,
              lastPageUrl: null,
            },
          },
          resolve,
        ),
      );
      await new Promise<void>((resolve, reject) =>
        chrome.runtime.sendMessage(
          { action: "start_background_upload", operationId },
          (response) => {
            const result = response as
              | { success?: boolean; error?: string }
              | undefined;
            result?.success
              ? resolve()
              : reject(
                  new Error(result?.error || "Upload queue gagal dimulai"),
                );
          },
        ),
      );
    } catch (error) {
      setUploading(false);
      setUploadOperationId("");
       showStatus(
        error instanceof Error ? error.message : "Upload screenshot gagal.",
        "error",
      );
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          CAPTURE CONTROLLER
        </p>
        <h2 className="mt-2 text-2xl font-serif font-medium text-slate-900">
          Upload Capture
        </h2>
        <p className="mb-6 mt-2 text-sm text-slate-500">
          Target &amp; Expand Section Setup
        </p>
        <label className="block text-xs font-bold text-slate-600">
          Confluence Page ID
          <input
            className={fieldClass}
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            onBlur={() => void fetchSections()}
            placeholder="6597588"
          />
        </label>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchSections()}
            disabled={loadingPage}
          >
            {loadingPage ? "Loading..." : "Fetch Sections"}
          </Button>
        </div>
        <div className="mt-5">
          <p className="text-xs font-bold text-slate-600">
            Target Expand Section
          </p>
          <div className="mt-2 flex gap-2">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                Scenario for Upload
                <select
                  className={`${fieldClass} mt-0`}
                  value={selectedScenarioId}
                  onChange={(event) => {
                    setSelectedScenarioId(event.target.value);
                    setSelectedExpandId("");
                  }}
                >
                  <option value="">Select Scenario / Test Case</option>
                  {scenarios.map((item) => (
                    <option key={item.scenarioId} value={item.scenarioId}>
                      {item.scenarioTitle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Target Expand Section
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className={`${fieldClass} mt-0`}
                    value={selectedExpandId}
                    disabled={!selectedScenarioId}
                    onChange={(event) =>
                      setSelectedExpandId(event.target.value)
                    }
                  >
                    <option value="">Select Target Expand Section</option>
                    {selectedScenario?.expandSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  {selectedScenarioId &&
                    !selectedScenario?.expandSections.length && (
                      <p className="text-xs text-slate-500">
                        There's No Expand Section Please Create new one
                      </p>
                    )}
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 text-lg text-blue-600"
                    disabled={!selectedScenarioId}
                    onClick={() => setSectionEditor({ id: null, title: "" })}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 text-sm text-slate-500"
                    disabled={!selectedExpandId}
                    onClick={() =>
                      setSectionEditor({
                        id: selectedExpandId,
                        title: selectedSection?.title || "",
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-red-100 px-3 text-sm text-red-500"
                    disabled={!selectedExpandId}
                    onClick={() => {
                      setDeleteId(selectedScenarioId + "::" + selectedExpandId);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs font-bold text-slate-600">File Source</p>
          <p className="mt-2 text-xs text-slate-500">Local files only</p>
        </div>
      </section>
      <section className="min-w-0 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          EVIDENCE UPLOAD ZONE
        </p>
        <h2 className="mt-2 text-2xl font-serif font-medium text-slate-900">
          File Dropzone &amp; Preview
        </h2>
        <p className="mb-6 mt-2 text-sm text-slate-500">
           Drop screenshots here, paste from clipboard, or choose files to attach to the selected
          Confluence section.
        </p>
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files).filter((file) =>
              file.type.startsWith("image/"),
            );
            setPreviews((current) => [
              ...current,
               ...files.map(makePreview),
            ]);
          }}
          className="flex min-h-44 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 text-center"
        >
          <span className="text-3xl">&#8682;</span>
          <span className="mt-3 text-sm font-bold text-slate-700">
            Drag &amp; Drop screenshots or folder here
          </span>
           <span className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP</span>
           <span className="mt-1 text-xs text-slate-400">atau paste (Ctrl+V) screenshot dari clipboard</span>
          <div className="mt-4 flex gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
              Choose Folder
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                {...{ webkitdirectory: "" }}
                onChange={addFiles}
              />
            </label>
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
              Choose Images
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={addFiles}
              />
            </label>
          </div>
        </div>
        <div className="mt-6 max-h-[430px] overflow-y-auto rounded-2xl border border-slate-100">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Attachment Preview
            </p>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">
                    {previews.length} files 
                  </span>
                  <Button
                  onClick={() => setConfirmUpload(true)}
                  disabled={
                    !previews.length ||
                    !pageId.trim() ||
                    !selectedScenarioId ||
                    !selectedExpandId ||
                    uploading
                  }
                >
                  {uploading ? "Uploading..." : "Upload Captures to Confluence"}
                </Button>
              </div>
          </div>
          {previews.length ? (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              {previews.map((preview, index) => (
                <div
                  key={preview.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) reorder(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="rounded-xl border border-slate-100 bg-white p-2 shadow-sm"
                >
                   <p className="text-[11px] text-slate-700">
                    {index + 1}. Size: {(preview.size / 1024).toFixed(1)} KB · {preview.name}
                  </p>                     
                   <textarea className="mt-2 h-14 w-full resize-none rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500" placeholder="Tulis caption untuk gambar ini..." value={preview.caption} onChange={(event) => setPreviews((current) => current.map((item) => item.id === preview.id ? { ...item, caption: event.target.value } : item))} />
                  <img src={editedImages[preview.id] || preview.url} alt={preview.name} className="h-28 w-full rounded-lg object-contain bg-slate-50" />

                  <div className="mt-2 flex justify-between">
                    
                     <div className="flex items-center gap-1">
                       <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => setViewPreview(preview)}>View</button>
                       <button type="button" className="rounded-md border border-blue-100 px-2 py-1 text-xs font-bold text-blue-600" onClick={() => openEditor(preview)}>Edit</button>
                       <button
                        type="button"
                        className="px-1 text-xs"
                        onClick={() => reorder(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-1 text-xs"
                        onClick={() => reorder(index, index + 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-xs font-bold text-red-500"
                        onClick={() => {
                          URL.revokeObjectURL(preview.url);
                          setPreviews((current) =>
                            current.filter((item) => item.id !== preview.id),
                          );
                        }}
                      >
                        Remove
                      </button>
         </div>
         {viewPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-5" onClick={() => setViewPreview(null)}><button type="button" aria-label="Close preview" className="absolute right-5 top-5 text-3xl text-white" onClick={() => setViewPreview(null)}>×</button><img src={editedImages[viewPreview.id] || viewPreview.url} alt={viewPreview.name} className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} /></div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-12 text-center text-sm text-slate-400">
              No screenshots selected yet.
            </p>
          )}
        </div>
      </section>
      <Dialog
        open={Boolean(sectionEditor)}
        title={sectionEditor?.id ? "Edit Expand Section" : "Add Expand Section"}
        preventClose
      >
        {sectionEditor && (
          <div>
            <input
              className={fieldClass}
              value={sectionEditor.title}
              onChange={(event) =>
                setSectionEditor({
                  ...sectionEditor,
                  title: event.target.value,
                })
              }
              placeholder="Screen Capture"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSectionEditor(null)}>
                Cancel
              </Button>
              <Button onClick={saveSection}>Save</Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(deleteId)}
        title="Delete Expand Section?"
        preventClose
      >
        <p className="text-sm text-slate-500">
          Section ini akan dihapus dari daftar target.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={() => void removeSection()}
          >
            Yes
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmUpload}
        title="Are you sure want to upload captures?"
        preventClose
      >
        <p className="text-sm text-slate-500">
          Upload {previews.length} file ke{" "}
          {selectedSection?.title || "Expand Section"}?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmUpload(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setConfirmUpload(false);
              void upload();
            }}
          >
            Yes, Upload
          </Button>
        </div>
      </Dialog>
      <Dialog open={uploading} title="Uploading Captures" preventClose>
        <div className="space-y-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `%` }}
            />
          </div>
          <p className="text-center text-sm font-semibold text-slate-600">
            Uploading screenshots... ({uploadProgress}%)
          </p>
        </div>
      </Dialog>
      <Dialog open={loadingPage} title="" preventClose>
        <div className="flex flex-col items-center gap-4 py-5 text-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand" /><p className="text-sm font-semibold text-slate-600">Loading...</p></div>
      </Dialog>
      <StatusDialog message={status} tone={statusTone} onClose={() => setStatus("")} />
    </div>
  );
}
