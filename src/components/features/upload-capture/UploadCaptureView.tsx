import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusDialog } from "@/components/ui/StatusDialog";
import { requestApi, fieldClass } from "@/components/features/shared";
import { getConfluenceBaseUrl } from "@/lib/auth/session";
import { escapeHtml } from "@/lib/sit-template";
import { putBlob } from "@/lib/blob-store";
import { uploadEvidenceToExpand } from "@/lib/evidence-upload";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: header.match(/data:([^;]+)/)?.[1] || "image/png" });
}

// ID generator dipisah ke level modul agar tidak memanggil fungsi impure saat render.
const makeSectionId = () => `local-${Date.now()}`;

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const showStatus = (message: string, tone: "info" | "success" | "error" = "success") => { setStatusTone(tone); setStatus(message); };
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [viewPreview, setViewPreview] = useState<Preview | null>(null);
  const makePreview = useCallback((file: File): Preview => ({
    id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name,
    size: file.size, caption: "",
  }), []);
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
  }, [makePreview]);
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
  const updateConfluenceExpand = async (
    action: "add" | "edit" | "delete",
    title: string,
    nextTitle = "",
  ) => {
    const base = await getConfluenceBaseUrl();
    const page = await requestApi(
      `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}?expand=body.storage,version`,
    );
    const doc = new DOMParser().parseFromString(
      page.body?.storage?.value || "",
      "text/html",
    );
    const roots = [...doc.querySelectorAll("ac\\:structured-macro")]
      .filter(
        (node) =>
          (node.getAttribute("ac:name") || "").toLowerCase() === "expand",
      )
      .filter((node) => !node.parentElement?.closest("ac\\:structured-macro"));
    const root = roots.find((node) =>
      (
        node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent ||
        ""
      ).includes(selectedScenario?.scenarioId || ""),
    );
    if (!root) throw new Error("Scenario tidak ditemukan di Confluence.");
    const body = root.querySelector("ac\\:rich-text-body") || root;
    const target = [...body.querySelectorAll("ac\\:structured-macro")].find(
      (node) =>
        (node.getAttribute("ac:name") || "").toLowerCase() === "expand" &&
        (node.querySelector("ac\\:parameter[ac\\:name='title']")?.textContent ||
          "") === title,
    );
    const newExpand = `<ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">${escapeHtml(nextTitle)}</ac:parameter><ac:rich-text-body><p>Untuk Evidence...</p></ac:rich-text-body></ac:structured-macro>`;
    if (action === "add") {
      const insertAfter = target || body.querySelector("ac\\:structured-macro");
      if (insertAfter) insertAfter.insertAdjacentHTML("afterend", newExpand);
      else body.insertAdjacentHTML("beforeend", newExpand);
    }
    if (action === "edit" && target)
      target.querySelector("ac\\:parameter[ac\\:name='title']")!.textContent =
        nextTitle;
    if (action === "delete" && target) target.remove();
    if (action !== "add" && !target)
      throw new Error("Expand Section tidak ditemukan di Confluence.");
    const value = doc.body.innerHTML.replace(
      /<(br|hr|img|input|meta|link|col|source)(\s[^>]*)?>/gi,
      (tag, name, attrs = "") =>
        /\/\s*>$/.test(tag) ? tag : `<${name}${attrs} />`,
    );
    await requestApi(
      `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}`,
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
    );
  };
  const fetchSections = async () => {
    if (!pageId.trim())
      return showStatus("Isi Confluence Page ID terlebih dahulu.", "info");
    setLoadingPage(true);
    try {
      const base = await getConfluenceBaseUrl();
      const page = await requestApi(
        `${base}/rest/api/content/${encodeURIComponent(pageId.trim())}?expand=body.storage`,
      );
      const doc = new DOMParser().parseFromString(
        page.body?.storage?.value || "",
        "text/html",
      );
      const roots = [...doc.querySelectorAll("ac\\:structured-macro")]
        .filter(
          (node) =>
            (node.getAttribute("ac:name") || "").toLowerCase() === "expand",
        )
        .filter(
          (node) => !node.parentElement?.closest("ac\\:structured-macro"),
        );
      const found = roots.map((node, scenarioIndex) => {
        const title =
          node
            .querySelector("ac\\:parameter[ac\\:name='title']")
            ?.textContent?.trim() || `Scenario ${scenarioIndex + 1}`;
        const scenarioId = (
          title.match(/\bTC\d+\b/i)?.[0] || `SCENARIO-${scenarioIndex + 1}`
        ).toUpperCase();
        const inner = [
          ...node.querySelectorAll("ac\\:rich-text-body ac\\:structured-macro"),
        ]
          .filter(
            (child) =>
              (child.getAttribute("ac:name") || "").toLowerCase() === "expand",
          )
          .map((child, index) => ({
            id: `remote-${scenarioIndex}-${index}`,
            title:
              child
                .querySelector("ac\\:parameter[ac\\:name='title']")
                ?.textContent?.trim() || `Screen Capture ${index + 1}`,
          }));
        return {
          scenarioId,
          scenarioTitle: title,
          scenarioIndex: scenarioIndex + 1,
          expandSections: inner.length
            ? inner
            : [{ id: `remote-${scenarioIndex}-main`, title: "Screen Capture" }],
        };
      });
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
        sectionEditor.id ? "edit" : "add",
        selectedSection?.title || "",
        sectionEditor.title.trim(),
      );
      const scenarioId = selectedScenario.scenarioId;
      const newId = makeSectionId();
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
    if (!deleteId || !selectedSection) return;
    try {
      await updateConfluenceExpand("delete", selectedSection.title);
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
    const targetTitle = selectedSection?.title || "Screen Capture";
    let success = 0;
    let failed = 0;
    try {
      const confBase = await getConfluenceBaseUrl();
      // Alur web murni (tanpa background worker): per file — simpan blob ke
      // IndexedDB dulu, lalu upload attachment + sisipkan ke expand target.
      for (const preview of previews) {
        const editedUrl = editedImages[preview.id];
        const uploadBlob = editedUrl ? dataUrlToBlob(editedUrl) : preview.file;
        try {
          await putBlob(uploadBlob);
          await uploadEvidenceToExpand(
            confBase,
            pageId.trim(),
            uploadBlob,
            preview.name,
            selectedScenarioId,
            targetTitle,
            preview.caption,
          );
          success++;
        } catch {
          failed++;
        }
        setUploadProgress(Math.round(((success + failed) / previews.length) * 100));
      }
      if (failed)
        showStatus(`Upload selesai dengan masalah. Sukses: ${success}/${previews.length}, Gagal: ${failed}.`, "error");
      else
        showStatus(`Screenshots uploaded successfully! ${success} file berhasil di-upload.`);
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
      setPreviews([]);
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Upload screenshot gagal.",
        "error",
      );
    } finally {
      setUploading(false);
    }
  };
return (
  <div className="grid gap-6 font-sans text-ink lg:grid-cols-[340px_minmax(0,1fr)]">
    {/* LEFT SIDE: CONTROLLER PANEL */}
    <section className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-card p-6 shadow-sm">
      <div className="space-y-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
            Capture Controller
          </span>
          <h2 className="text-xl font-bold text-ink">Upload Capture</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Target & Expand Section Setup
          </p>
        </div>

        {/* CONFLUENCE PAGE ID INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">
            Confluence Page ID
          </label>
          <div className="flex gap-2">
            <input
              className={`${fieldClass} rounded-2xl border-slate-200 focus:border-brand`}
              value={pageId}
              onChange={(event) => setPageId(event.target.value)}
              onBlur={() => void fetchSections()}
              placeholder="e.g. 6597588"
            />
            <Button
              variant="outline"
              onClick={() => void fetchSections()}
              disabled={loadingPage}
              className="shrink-0 rounded-2xl border-slate-200 px-4 text-xs font-bold hover:bg-indigo-50 hover:text-brand"
            >
              {loadingPage ? "Fetching..." : "Fetch"}
            </Button>
          </div>
        </div>

        {/* SCENARIO & EXPAND SECTION SELECTORS */}
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-indigo-50/50 p-4">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Scenario for Upload
              <select
                className={`${fieldClass} mt-2 rounded-2xl border-slate-200 bg-card`}
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
            <label className="block text-xs font-bold text-slate-700">
              Target Expand Section
              <div className="mt-2 flex items-center gap-2">
                <select
                  className={`${fieldClass} mt-0 flex-1 rounded-2xl border-slate-200 bg-card disabled:opacity-50`}
                  value={selectedExpandId}
                  disabled={!selectedScenarioId}
                  onChange={(event) => setSelectedExpandId(event.target.value)}
                >
                  <option value="">Select Target Expand Section</option>
                  {selectedScenario?.expandSections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-200 bg-card px-3 py-2 text-lg leading-none text-brand shadow-sm hover:bg-indigo-50 disabled:opacity-40"
                  disabled={!selectedScenarioId}
                  onClick={() => setSectionEditor({ id: null, title: "" })}
                >
                  +
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-200 bg-card px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40"
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
                  className="shrink-0 rounded-xl border border-red-100 bg-card px-3 py-2 text-xs font-bold text-red-500 shadow-sm hover:bg-red-50 disabled:opacity-40"
                  disabled={!selectedExpandId}
                  onClick={() => {
                    setDeleteId(selectedScenarioId + "::" + selectedExpandId);
                  }}
                >
                  Delete
                </button>
              </div>
              {selectedScenarioId &&
                !selectedScenario?.expandSections.length && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    There's No Expand Section Please Create new one
                  </p>
                )}
            </label>
          </div>
        </div>
      </div>

    </section>

    {/* RIGHT SIDE: DROPZONE & PREVIEW GALLERY */}
    <section className="flex min-w-0 flex-col rounded-3xl border border-slate-200/80 bg-card p-6 shadow-sm">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
          Evidence Upload Zone
        </span>
        <h2 className="text-xl font-bold text-ink">
          File Dropzone & Preview
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Drop screenshots, paste clipboard image, or pick local files.
        </p>
      </div>

      {/* DROPZONE */}
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/"),
          );
          setPreviews((current) => [...current, ...files.map(makePreview)]);
        }}
        className="mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-soft/40 bg-indigo-50/30 p-5 text-center transition hover:border-brand hover:bg-indigo-50/60"
      >
        <span className="text-3xl">📥</span>
        <p className="mt-2 text-xs font-bold text-slate-700">
          Drag & Drop screenshots or folder here
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          PNG, JPG, WEBP · or press <kbd className="rounded border bg-card px-1 font-sans">Ctrl+V</kbd> to paste
        </p>

        <div className="mt-3 flex gap-2">
          <label className="cursor-pointer rounded-full border border-slate-200 bg-card px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
            📁 Choose Folder
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              {...{ webkitdirectory: "" }}
              onChange={addFiles}
            />
          </label>
          <label className="cursor-pointer rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-brand-foreground shadow-sm hover:bg-indigo-700">
            🖼️ Choose Images
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

      {/* PREVIEW CONTAINER */}
      <div className="mt-5 flex-1 rounded-2xl border border-slate-200/80 bg-card shadow-sm">
        {/* BAR TOP INFO */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-indigo-50 px-4 py-3">
          <span className="text-xs font-bold text-brand">
            Preview Queue ({previews.length} files)
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
            className="rounded-full bg-brand px-5 text-xs font-bold text-brand-foreground hover:bg-indigo-700 disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "🚀 Upload Captures"}
          </Button>
        </div>

        {/* PREVIEW ITEMS GRID */}
        <div className="max-h-[420px] overflow-y-auto p-4">
          {previews.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-card p-3 shadow-sm transition hover:border-brand-soft"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="truncate max-w-[150px]">
                        #{index + 1} {preview.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {(preview.size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <img
                      src={editedImages[preview.id] || preview.url}
                      alt={preview.name}
                      className="h-32 w-full rounded-xl object-contain bg-slate-50 border border-slate-100"
                    />

                    <textarea
                      className="h-14 w-full resize-none rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-brand"
                      placeholder="Write caption for this screenshot..."
                      value={preview.caption}
                      onChange={(event) =>
                        setPreviews((current) =>
                          current.map((item) =>
                            item.id === preview.id
                              ? { ...item, caption: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>

                  {/* ACTION FOOTER */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        onClick={() => setViewPreview(preview)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-orange-100 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-brand hover:bg-indigo-100"
                        onClick={() => openEditor(preview)}
                      >
                        Edit
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() => reorder(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() => reorder(index, index + 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="ml-1 text-[11px] font-bold text-red-500 hover:underline"
                        onClick={() => {
                          URL.revokeObjectURL(preview.url);
                          setPreviews((current) =>
                            current.filter((item) => item.id !== preview.id),
                          );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
              <span>📷</span>
              <p className="mt-1 text-xs">No screenshots selected yet.</p>
            </div>
          )}
        </div>
      </div>
    </section>

    {/* OVERLAY IMAGE PREVIEW MODAL */}
    {viewPreview && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur-sm"
        onClick={() => setViewPreview(null)}
      >
        <button
          type="button"
          aria-label="Close preview"
          className="absolute right-6 top-6 text-3xl font-bold text-white hover:text-slate-300"
          onClick={() => setViewPreview(null)}
        >
          ✕
        </button>
        <img
          src={editedImages[viewPreview.id] || viewPreview.url}
          alt={viewPreview.name}
          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    )}

    {/* DIALOGS */}
    <Dialog
      open={Boolean(sectionEditor)}
      title={sectionEditor?.id ? "Edit Expand Section" : "Add Expand Section"}
      preventClose
    >
      {sectionEditor && (
        <div className="space-y-4">
          <input
            className={`${fieldClass} rounded-2xl border-slate-200`}
            value={sectionEditor.title}
            onChange={(event) =>
              setSectionEditor({
                ...sectionEditor,
                title: event.target.value,
              })
            }
            placeholder="e.g. Screen Capture Scenario 1"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-full border-slate-200"
              onClick={() => setSectionEditor(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-brand text-brand-foreground hover:bg-indigo-700"
              onClick={saveSection}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Dialog>

    <Dialog
      open={Boolean(deleteId)}
      title="Delete Expand Section?"
      preventClose
    >
      <p className="text-sm text-slate-600">
        Section ini akan dihapus dari daftar target.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200"
          onClick={() => setDeleteId(null)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-red-600 text-white hover:bg-red-700"
          onClick={() => void removeSection()}
        >
          Delete
        </Button>
      </div>
    </Dialog>

    <Dialog
      open={confirmUpload}
      title="Confirm Upload Captures"
      preventClose
    >
      <p className="text-sm text-slate-600">
        Upload <strong>{previews.length} file</strong> ke section{" "}
        <strong>{selectedSection?.title || "Target Section"}</strong>?
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200"
          onClick={() => setConfirmUpload(false)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-brand text-brand-foreground hover:bg-indigo-700"
          onClick={() => {
            setConfirmUpload(false);
            void upload();
          }}
        >
          Yes, Upload Now
        </Button>
      </div>
    </Dialog>

    <Dialog open={uploading} title="Uploading Captures..." preventClose>
      <div className="space-y-4 py-2">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-center text-xs font-semibold text-slate-600">
          Uploading screenshots... ({uploadProgress}%)
        </p>
      </div>
    </Dialog>

    <Dialog open={loadingPage} title="" preventClose>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF7A00]" />
        <p className="text-xs font-semibold text-slate-600">
          Fetching Confluence Sections...
        </p>
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
