import { useCallback, useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import {
  checkExistingTree,
  createTmpIsoApi,
  generateTmpIsoTree,
  type TmpIsoApi,
} from "./lib/generate";
import { buildPageTree } from "./lib/page-tree";
import type { PageResult, PageResultStatus, TmpIsoProjectConfig } from "./lib/types";
import { persistFixes, scanPages, type VerifyPage } from "./lib/verify";
import { TagFixPanel, type PersistUpdate } from "./TagFixPanel";

const fieldClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

const DEFAULT_TEMPLATE_ID = "2096826162";

const INITIAL_FORM: TmpIsoProjectConfig = {
  idProject: "",
  projectName: "",
  namaFungsi: "",
  namaProyek: "",
  namaAplikasi: "",
  namaModul: "",
  onboardingDate: getTodayDateString(),
  templateRootPageId: DEFAULT_TEMPLATE_ID,
  targetSpaceKey: "",
  targetParentPageId: "",
  linkJiraProject: "",
  linkBrd: "",
  linkSystemDesignDev: "",
  linkNcm: "",
  linkJiraUqa: "",
  linkJiraDast: "",
  linkConfluenceDast: "",
  linkJiraSitTe: "",
  linkJiraUatTe: "",
  linkJiraBug: "",
  linkMigDev: "",
  linkSopDeployment: "",
  linkSopMaintenance: "",
  linkSopMonitoring: "",
  linkSopTroubleshooting: "",
};

// Daftar Field Mandatori (srs-automation-tmp.md 7.2) per step.
const REQUIRED_FIELDS_CONFIG: Array<{ key: Exclude<keyof TmpIsoProjectConfig, "templateRootPageId" | "linkNcm" | "linkJiraDast" | "linkConfluenceDast" | "linkJiraBug" | "linkMigDev">; label: string; step: number }> = [
  { key: "idProject", label: "ID Project / Key", step: 1 },
  { key: "projectName", label: "Project Name", step: 1 },
  { key: "targetSpaceKey", label: "Target Space Key", step: 1 },
  { key: "targetParentPageId", label: "Target Parent Page ID", step: 1 },
  { key: "onboardingDate", label: "Onboarding Date", step: 1 },
  { key: "linkBrd", label: "Link BRD", step: 2 },
  { key: "linkSystemDesignDev", label: "Link System Design (Dev)", step: 2 },
  { key: "linkJiraProject", label: "Link Jira Project", step: 3 },
  { key: "linkJiraSitTe", label: "Link Jira SIT (TE)", step: 3 },
  { key: "linkJiraUatTe", label: "Link Jira UAT (TE)", step: 3 },
  { key: "linkJiraUqa", label: "Link Jira UQA", step: 3 },
];

const STEPS = [
  { id: 1, title: "General Info", desc: "Project ID & Target Location" },
  { id: 2, title: "Confluence Links", desc: "BRD, Design, & System Links" },
  { id: 3, title: "Jira Integration", desc: "Boards, SIT, UAT, & Defect Filters" },
];

const STATUS_COLOR: Record<PageResultStatus, string> = {
  success: "text-emerald-600",
  failed: "text-rose-600",
  blocked: "text-amber-600",
  unfilled: "text-slate-500",
};

async function getConfluenceBaseUrl(): Promise<string> {
  const stored = await chrome.storage.local.get(["confUrl"]);
  const confBase = String(stored.confUrl || "").replace(/\/$/, "");
  if (!confBase) throw new Error("URL Confluence belum dikonfigurasi.");
  return confBase;
}

// Donut chart: segmen berhasil (emerald) dan gagal (rose) via SVG stroke.
function Donut({ successPct }: { successPct: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = (successPct / 100) * circ;
  const failedPct = 100 - successPct;
  return (
    <div className="relative h-40 w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        {/* Track (gagal) */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#fecaca" strokeWidth="14" />
        {/* Segmen sukses */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#34d399"
          strokeWidth="14"
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-black text-slate-800">{successPct}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Berhasil</span>
        <span className="text-[10px] font-semibold text-rose-500">{failedPct}% Gagal</span>
      </div>
    </div>
  );
}

function ResultScreen({
  confBase,
  results,
  successPct,
  failedPct,
  onNew,
  verifyPages,
  verifying,
  onCheckAgain,
  onPersist,
}: {
  confBase: string;
  results: PageResult[];
  successPct: number;
  failedPct: number;
  onNew: () => void;
  verifyPages: VerifyPage[] | null;
  verifying: boolean;
  onCheckAgain: () => void;
  onPersist: (updates: PersistUpdate[]) => Promise<void>;
}) {
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status !== "success").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* HEADER & ACTION TOP BAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/10 uppercase tracking-wider">
              Execution Report
            </span>
            <span className="text-xs text-slate-400">• Total {results.length} Halaman</span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Hasil Generate TMP/ISO
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Ringkasan eksekusi pembuatan struktur dokumen Confluence & Jira.
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
            <Donut successPct={successPct} />
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
              <div className="text-3xl font-bold text-emerald-950">{successCount}</div>
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
              <div className="text-3xl font-bold text-rose-950">{failedCount}</div>
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
            <h2 className="text-sm font-semibold text-slate-800">Detail Hasil Pembuatan Halaman</h2>
            <p className="text-[11px] text-slate-400">Daftar status per-node/halaman yang baru diproses.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-600">
            {results.length} Rows
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Status</th>
                <th className="px-4 py-3">Action / Phase</th>
                <th className="px-4 py-3">Page Title</th>
                <th className="px-6 py-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {results.map((r, index) => (
                <tr key={`${r.phase}-${r.pageId || index}`} className="hover:bg-slate-50/60 transition-colors align-top">
                  {/* STATUS */}
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className={`font-mono text-xs font-bold ${STATUS_COLOR[r.status] || "text-slate-600"}`}>
                      {r.status}
                    </span>
                  </td>

                  {/* ACTION / PHASE */}
                  <td className="px-4 py-3.5 font-medium text-slate-500 whitespace-nowrap">
                    {r.phase}
                  </td>

                  {/* TITLE & ERROR */}
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-slate-800 block">{r.title}</span>
                    {r.error && (
                      <span className="mt-1 block break-all text-[11px] text-rose-600 bg-rose-50 rounded-lg p-2 border border-rose-100">
                        ⚠️ {r.error}
                      </span>
                    )}
                  </td>

                  {/* CONFLUENCE LINK */}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERIFIKASI TOKEN PANEL */}
      <div className="rounded-3xl border border-indigo-100/60 bg-white p-6 shadow-xl shadow-indigo-100/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span>🔍</span> Verifikasi Token Belum Terisi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Scan ulang halaman hasil generate untuk menemukan <code className="text-indigo-600 font-semibold">{"{{...}}"}</code> yang belum terisi.
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

        {verifyPages !== null && (
          <div className="mt-4">
            <TagFixPanel pages={verifyPages} busy={verifying} confBase={confBase} onApply={onPersist} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateTmpIsoView() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<TmpIsoProjectConfig>(INITIAL_FORM);
  const [confBase, setConfBase] = useState("");

  // Modal States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [tempTemplateId, setTempTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [validationErrors, setValidationErrors] = useState<Array<{ label: string; step: number }>>([]);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  // Execution States
  const [existingWarning, setExistingWarning] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PageResult[]>([]);
  const [status, setStatus] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);
  // "form" = layar isi field; "result" = layar hasil generate (donut + tabel).
  const [view, setView] = useState<"form" | "result">("form");
  // State untuk "Check Ulang" (scan {{...}} belum terisi) di layar hasil.
  const [api, setApi] = useState<TmpIsoApi | null>(null);
  const [createdPageIds, setCreatedPageIds] = useState<string[]>([]);
  const [verifyPages, setVerifyPages] = useState<VerifyPage[] | null>(null);
  const [verifying, setVerifying] = useState(false);

  const setField = (key: keyof TmpIsoProjectConfig, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleIdProjectChange = (val: string) => {
    setForm((current) => ({ ...current, idProject: val, linkJiraProject: val }));
  };

  const handleSaveTemplateId = () => {
    setField("templateRootPageId", tempTemplateId);
    setEditTemplateOpen(false);
  };

  // Validasi Keseluruhan saat Klik Generate
  const validateAllFields = () => {
    const missing: Array<{ label: string; step: number }> = [];
    REQUIRED_FIELDS_CONFIG.forEach((field) => {
      if (!form[field.key] || !form[field.key].trim()) {
        missing.push({ label: field.label, step: field.step });
      }
    });
    return missing;
  };

  const handleAttemptGenerate = async () => {
    const errors = validateAllFields();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setErrorModalOpen(true);
      return;
    }
    setStatus(null);
    setConfirmOpen(true);
    try {
      const base = await getConfluenceBaseUrl();
      const api = createTmpIsoApi(base);
      setExistingWarning(await checkExistingTree(form, api));
    } catch {
      setExistingWarning(false);
    }
  };

  const runGenerate = async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResults([]);
    setVerifyPages(null);
    try {
      const base = await getConfluenceBaseUrl();
      const createdApi = createTmpIsoApi(base);
      const outcome = await generateTmpIsoTree(form, createdApi, base, {
        onProgress: (result) => setResults((prev) => [...prev, result]),
      });
      setConfBase(base);
      setApi(createdApi);
      setCreatedPageIds(outcome.pages.map((p) => p.pageId));
      setResults(outcome.results);
      setStatus({ message: "Proses generate selesai. Silakan periksa status di bawah.", tone: "success" });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Generate TMP/ISO gagal.", tone: "error" });
    } finally {
      setRunning(false);
      // Mau failed ataupun berhasil, pindah ke layar hasil (donut + tabel).
      setView("result");
    }
  };

  // "Check Ulang": scan ulang page yang barusan dibuat untuk {{...}} yang belum terisi.
  const checkAgain = useCallback(async () => {
    if (!api || !createdPageIds.length) return;
    setVerifying(true);
    try {
      setVerifyPages(await scanPages(api, createdPageIds));
    } finally {
      setVerifying(false);
    }
  }, [api, createdPageIds]);

  // Terapkan fix pilihan user (persist via PUT) lalu scan ulang.
  const applyFixes = useCallback(
    async (updates: PersistUpdate[]) => {
      if (!api) return;
      await persistFixes(api, updates);
      await checkAgain();
    },
    [api, checkAgain],
  );

  // Balik ke layar isi field dengan kondisi bersih untuk generate baru.
  const resetForNew = () => {
    setForm(INITIAL_FORM);
    setResults([]);
    setStatus(null);
    setConfBase("");
    setCurrentStep(1);
    setExistingWarning(false);
    setConfirmOpen(false);
    setErrorModalOpen(false);
    setApi(null);
    setCreatedPageIds([]);
    setVerifyPages(null);
    setVerifying(false);
    setView("form");
  };

  const tree = buildPageTree(form);
  const templateConfluenceUrl = `https://confluence.bri.co.id/spaces/UQF/pages/${form.templateRootPageId}`;

  // Layar hasil generate: ganti form (Prev/Next/Generate) dengan donut + tabel.
  if (view === "result") {
    const successCount = results.filter((r) => r.status === "success").length;
    const total = results.length || 1;
    const successPct = Math.round((successCount / total) * 100);
    const failedPct = 100 - successPct;
    return (
      <ResultScreen
        confBase={confBase}
        results={results}
        successPct={successPct}
        failedPct={failedPct}
        onNew={() => resetForNew()}
        verifyPages={verifyPages}
        verifying={verifying}
        onCheckAgain={() => void checkAgain()}
        onPersist={applyFixes}
      />
    );
  }


  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* HEADER SECTION */}
      <div className="text-center sm:text-left">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Generate TMP/ISO Project
        </h1>
        <p className="mt-1.5 text-xs font-normal text-slate-500 sm:text-sm">
          Lengkapi informasi project untuk menghasilkan dokumentasi Confluence & Jira secara terstruktur.
        </p>
      </div>

      {/* STEP NAVIGATION WIZARD */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/80 p-1.5 backdrop-blur-md border border-slate-200/60 shadow-inner">
        {STEPS.map((step: any) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col items-center justify-center rounded-xl py-2.5 px-2 text-center transition-all duration-200 ${
                isActive
                  ? "bg-white text-indigo-950 shadow-md shadow-slate-200/50 font-semibold ring-1 ring-black/5"
                  : isCompleted
                  ? "text-indigo-600 hover:bg-white/50"
                  : "text-slate-400 hover:text-slate-700 hover:bg-white/30"
              }`}
            >
              <span className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                {isCompleted ? "✓ Step 0" + step.id : `Step 0${step.id}`}
              </span>
              <span className="text-xs font-medium sm:text-sm truncate w-full px-1">
                {step.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* ALERT / STATUS BANNER */}
      {status && (
        <div
          className={`rounded-2xl p-4 text-xs font-medium backdrop-blur-md transition-all flex items-center justify-between border ${
            status.tone === "error"
              ? "bg-rose-50/90 text-rose-800 border-rose-200/60 shadow-sm"
              : "bg-emerald-50/90 text-emerald-800 border-emerald-200/60 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{status.tone === "error" ? "🚨" : "✅"}</span>
            <span>{status.message}</span>
          </div>
        </div>
      )}

      {/* MAIN ELEGANT CARD CONTAINER */}
      <div className="rounded-3xl border border-indigo-100/60 bg-white p-6 shadow-xl shadow-indigo-100/30 sm:p-8 transition-all">
        {/* STEP 1: GENERAL INFO */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-serif text-xl font-medium text-slate-900">General Information</h2>
              <p className="text-xs text-slate-400 mt-0.5">Identitas project dan lokasi tujuan di Confluence.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">ID Project / Key <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="e.g. PROJ-123" value={form.idProject} onChange={(e) => handleIdProjectChange(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Project Name <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="Masukkan Nama Project" value={form.projectName} onChange={(e) => setField("projectName", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Target Space Key <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="e.g. SIM" value={form.targetSpaceKey} onChange={(e) => setField("targetSpaceKey", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Target Parent Page ID <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="Contoh: 12345678" value={form.targetParentPageId} onChange={(e) => setField("targetParentPageId", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Onboarding Date <span className="text-rose-500">*</span></label>
              <input className={`${fieldClass} mt-1.5`} value={form.onboardingDate} onChange={(e) => setField("onboardingDate", e.target.value)} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Fungsi <span className="text-slate-400 font-normal">(Opsional)</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="QCP" value={form.namaFungsi} onChange={(e) => setField("namaFungsi", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Proyek <span className="text-slate-400 font-normal">(Opsional)</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="Isi {{nama_proyek}}" value={form.namaProyek} onChange={(e) => setField("namaProyek", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Aplikasi <span className="text-slate-400 font-normal">(Opsional)</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="Isi {{nama_aplikasi}}" value={form.namaAplikasi} onChange={(e) => setField("namaAplikasi", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Modul <span className="text-slate-400 font-normal">(Opsional)</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="Isi {{nama_modul}}" value={form.namaModul} onChange={(e) => setField("namaModul", e.target.value)} />
              </div>
            </div>

            {/* TEMPLATE SAMPLE CONTAINER */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Template Root Page ID</label>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5">
                <a href={templateConfluenceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-[240px] flex items-center gap-1" title="Klik untuk membuka sampel di Confluence">
                  <span>Sample Root ({form.templateRootPageId})</span>
                  <span>↗</span>
                </a>
                <button type="button" onClick={() => { setTempTemplateId(form.templateRootPageId); setEditTemplateOpen(true); }} className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:underline">
                  Edit Sample
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CONFLUENCE ARTIFACTS */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-serif text-xl font-medium text-slate-900">Confluence Artifacts</h2>
              <p className="text-xs text-slate-400 mt-0.5">Dokumentasi BRD, System Design, serta lampiran pendukung.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Link BRD <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkBrd} onChange={(e) => setField("linkBrd", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Link System Design (Dev) <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkSystemDesignDev} onChange={(e) => setField("linkSystemDesignDev", e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Link MIG Dev <span className="text-slate-400 font-normal">(Opsional)</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkMigDev} onChange={(e) => setField("linkMigDev", e.target.value)} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link SOP Deployment <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkSopDeployment} onChange={(e) => setField("linkSopDeployment", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link SOP Maintenance <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkSopMaintenance} onChange={(e) => setField("linkSopMaintenance", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link SOP Monitoring <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkSopMonitoring} onChange={(e) => setField("linkSopMonitoring", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link SOP Troubleshooting <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://confluence.bri.co.id/..." value={form.linkSopTroubleshooting} onChange={(e) => setField("linkSopTroubleshooting", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link NCM <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://..." value={form.linkNcm} onChange={(e) => setField("linkNcm", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link Confluence DAST <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://..." value={form.linkConfluenceDast} onChange={(e) => setField("linkConfluenceDast", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: JIRA INTEGRATION */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-serif text-xl font-medium text-slate-900">Jira Integration</h2>
              <p className="text-xs text-slate-400 mt-0.5">Tautan board testing, eksekusi, serta pelacakan defect.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Link Jira Project <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="https://jira.bri.co.id/browse/PROJ" value={form.linkJiraProject} onChange={(e) => setField("linkJiraProject", e.target.value)} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link Jira SIT (TE) <span className="text-rose-500">*</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://jira.bri.co.id/..." value={form.linkJiraSitTe} onChange={(e) => setField("linkJiraSitTe", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link Jira UAT (TE) <span className="text-rose-500">*</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://jira.bri.co.id/..." value={form.linkJiraUatTe} onChange={(e) => setField("linkJiraUatTe", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Link Jira UQA <span className="text-rose-500">*</span></label>
                <input className={`${fieldClass} mt-1.5`} placeholder="https://jira.bri.co.id/..." value={form.linkJiraUqa} onChange={(e) => setField("linkJiraUqa", e.target.value)} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link Jira DAST <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://..." value={form.linkJiraDast} onChange={(e) => setField("linkJiraDast", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Link Jira Bug <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input className={`${fieldClass} mt-1.5`} placeholder="https://..." value={form.linkJiraBug} onChange={(e) => setField("linkJiraBug", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION BUTTONS */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200 px-5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            onClick={() => setCurrentStep((prev: number) => Math.max(prev - 1, 1))}
            disabled={currentStep === 1 || running}
          >
            ← Prev
          </Button>

          <div className="flex items-center gap-3">
            {currentStep < 3 ? (
              <Button
                type="button"
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all"
                onClick={() => setCurrentStep((prev: number) => Math.min(prev + 1, 3))}
              >
                Next Step →
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all"
                onClick={() => void handleAttemptGenerate()}
                disabled={running}
              >
                {running ? "Processing..." : "Generate Space Tree"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* INLINE PER-PAGE RESULT (JIKA SUDAH ADA RESULTS) */}
      {results && results.length > 0 && (
        <div className="rounded-3xl border border-indigo-100/60 bg-white p-5 shadow-xl shadow-indigo-100/30">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Per-Page Execution Status</p>
            <span className="text-[11px] font-mono text-slate-400">{results.length} Pages</span>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {results.map((r: any) => (
              <li key={`${r.phase}-${r.pageId || r.key}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div className="flex items-center gap-2">
<span className={`font-mono text-[11px] font-bold ${STATUS_COLOR[r.status as PageResultStatus] ?? "text-slate-600"}`}>
  {r.status}
</span>                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 font-medium">{r.phase}</span>
                  <span className="text-slate-800 font-semibold">{r.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.pageId && confBase ? (
                    <a className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded hover:underline" href={`${confBase}/pages/viewpage.action?pageId=${r.pageId}`} target="_blank" rel="noreferrer">
                      #{r.pageId} ↗
                    </a>
                  ) : null}
                  {r.error ? <span className="text-rose-600 text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-100 break-all">{r.error}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ERROR MODAL */}
      <Dialog open={errorModalOpen} title="Field Wajib Belum Lengkap" onClose={() => setErrorModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Harap lengkapi beberapa informasi mandatori berikut sebelum dapat melakukan generate space tree:
          </p>
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
            <ul className="space-y-2 text-xs text-rose-800">
              {validationErrors.map((err: any, idx: number) => (
                <li key={idx} className="flex items-center justify-between">
                  <span className="font-medium">• {err.label}</span>
                  <button type="button" className="text-[10px] font-bold text-rose-600 underline hover:text-rose-900" onClick={() => { setErrorModalOpen(false); setCurrentStep(err.step); }}>
                    Buka Step 0{err.step}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-2">
            <Button className="rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700" onClick={() => setErrorModalOpen(false)}>
              Paham, Lengkapi Data
            </Button>
          </div>
        </div>
      </Dialog>

      {/* CONFIRM DIALOG */}
      <Dialog open={confirmOpen} title="Yakin mau create?" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 space-y-1.5 text-xs text-slate-600 border border-slate-100">
            <p><strong>Project:</strong> {form.projectName || "-"} ({form.idProject || "-"})</p>
            <p><strong>Target Space:</strong> {form.targetSpaceKey.toUpperCase() || "-"}</p>
            <p><strong>Parent Page ID:</strong> {form.targetParentPageId || "-"}</p>
          </div>

          <p className="text-xs text-slate-500">
            Sistem akan membuat struktur halaman dokumentasi baru di Confluence secara otomatis.
          </p>

          <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3.5 text-[11px] text-slate-600">
            <span className="font-semibold block mb-1.5 text-slate-800">Daftar Halaman yang Akan Dibuat:</span>
            <ul className="space-y-1">
              {tree.map((item: any) => (
                <li key={item.key} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {existingWarning && (
            <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
              ⚠️ Space tree untuk Project ID ini sudah pernah dibuat sebelumnya. Melanjutkan dapat membuat halaman duplikat.
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" className="rounded-xl text-xs font-semibold border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-100" onClick={() => void runGenerate()}>
              Yes, Generate Tree
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL EDIT TEMPLATE ROOT */}
      <Dialog open={editTemplateOpen} title="Edit Sample Root Page ID" onClose={() => setEditTemplateOpen(false)}>
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Ubah Root Page ID bawaan agar sesuai dengan struktur template Confluence divisi kamu.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Template Root Page ID</label>
            <input className={`${fieldClass} mt-1.5 rounded-xl`} value={tempTemplateId} onChange={(e) => setTempTemplateId(e.target.value)} placeholder="Contoh: 2096826162" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => setEditTemplateOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800" onClick={handleSaveTemplateId}>
              Save Sample ID
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
