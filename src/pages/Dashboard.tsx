import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { clearSession, loadSession } from "@/lib/auth/session";
import {
  FileText,
  RefreshCw,
  ImagePlus,
  FileSpreadsheet,
  Home,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
  Moon,
  Check,
} from "lucide-react";
import { ActionFooter } from "../components/features/check-sync-te/ActionFooter";
import { CompareController } from "../components/features/check-sync-te/CompareController";
import { ComparisonTable } from "../components/features/check-sync-te/ComparisonTable";
import { MetricCards } from "../components/features/check-sync-te/MetricCards";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { ImportTestCaseView } from "../components/features/import-test-case/ImportTestCaseView";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { useCompareLogic } from "../hooks/useCompareLogic";
import {
  extractPageId,
  macroKey,
  tableKey,
  testCaseMacros,
  updateConfluence,
} from "../lib/confluence-api";
import { createConfluenceClient } from "@/lib/api/confluence";
import { buildSingleTcHtml } from "@/lib/sit-template";
import type { ComparisonResult } from "../types";
import ImageEditorView from "@/components/features/upload-capture/ImageEditor";
import "../styles/tailwind.css";
import CreateSitPageView from "@/components/features/create-sit-page/CreateSitPageView";
import CreateTmpIsoView from "@/components/features/create-tmpi-so/CreateTmpIsoView";
import UploadCaptureView from "@/components/features/upload-capture/UploadCaptureView";
import JiraTeView from "@/components/features/check-sync-te/JiraTeView";

type NavTab = "home" | "create" | "tmp-iso" | "check-sync-te" | "upload" | "import";

/* Theme Switcher Popover — docs/DESIGN_SYSTEM.md §4.2.
   Swatch memakai warna tetap sesuai spec (preview tema, bukan UI ter-theme). */
const THEME_GROUPS = [
  {
    label: "Light Mode",
    options: [
      { id: "orange-light", label: "Sunset", swatch: "#FF7A00", outline: "#FFFFFF", check: "#0A0A0C" },
      { id: "blue-light", label: "Ocean", swatch: "#6089E4", outline: "#FFFFFF", check: "#FFFFFF" },
      { id: "coral-light", label: "Coral", swatch: "#FFB6A6", outline: "#FFFFFF", check: "#0A0A0C" },
    ],
  },
  {
    label: "Dark Mode",
    options: [
      { id: "orange-dark", label: "Sunset", swatch: "#FF7A00", outline: "#0F172A", check: "#0A0A0C" },
      { id: "blue-dark", label: "Ocean", swatch: "#6089E4", outline: "#0B132B", check: "#FFFFFF" },
      { id: "coral-dark", label: "Coral", swatch: "#FFB6A6", outline: "#1A1211", check: "#0A0A0C" },
    ],
  },
] as const;

function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-2xl border border-line bg-popover p-4 shadow-panel animate-fadeIn"
    >
      <p className="font-serif text-base text-ink">Ganti Tema</p>
      {THEME_GROUPS.map((group) => (
        <div key={group.label} className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="mt-2 flex gap-3">
            {group.options.map((option) => {
              const isActive = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setTheme(option.id);
                    onClose();
                  }}
                  className="group flex w-12 flex-col items-center gap-1"
                  aria-label={`Tema ${option.label} — ${group.label}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110 ${
                      isActive ? "ring-2 ring-brand ring-offset-2 ring-offset-popover" : ""
                    }`}
                    style={{ backgroundColor: option.swatch, borderColor: option.outline }}
                  >
                    {isActive && <Check className="h-3.5 w-3.5" style={{ color: option.check }} />}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  if (location.hash === "#image-editor") return <ImageEditorView />;
  return <DashboardContent />;
}

function DashboardContent() {
  const navigate = useNavigate();
  const [editedImages, setEditedImages] = useState<Record<string, string>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState(() => loadSession());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  // Profil sidebar diperkaya oleh silent validation (validation.ts) — ikuti update-nya.
  useEffect(() => {
    const onSessionUpdated = () => setSession(loadSession());
    window.addEventListener("qpilot-session-updated", onSessionUpdated);
    return () => window.removeEventListener("qpilot-session-updated", onSessionUpdated);
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "qpilot-image-edit-result"
      )
        return;
      setEditedImages((current) => ({
        ...current,
        [event.data.sessionId]: event.data.dataUrl,
      }));
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

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
      // Mutasi Confluence (add/remove TC) memakai Confluence PAT + header XSRF,
      // bukan Jira client — di extension auth dipegang service worker, di web
      // harus lewat Confluence client (apiFetch + PAT Confluence).
      const client = createConfluenceClient(connection.confBase);
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
          const html = buildSingleTcHtml(
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
          );
          if (!html) throw new Error(`Template untuk ${row.key} tidak tersedia.`);
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
<div className="space-y-6 text-ink">
  {/* ROW ATAS: KIRI & KANAN */}
  <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    {/* KIRI: CONTROLLER */}
    <CompareController
      pageId={pageId}
      executionKey={executionKey}
      setPageId={setPageId}
      setExecutionKey={setExecutionKey}
      onCompare={() => void runCompare()}
      loading={loading}
    />

    {/* KANAN: METRICS SUMMARY CARD */}
    <Card className="rounded-3xl border border-slate-200/80 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-ink">
            Execution Metrics Overview
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ringkasan status sinkronisasi Jira Test Execution dan Confluence.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-bold text-brand">
          {summary.jiraTotal} Jira TC
        </span>
      </CardHeader>
      <CardContent className="pt-5">
        <MetricCards summary={summary} />
      </CardContent>
    </Card>
  </div>

  {/* ROW BAWAH: DATA TABLE FULL WIDTH */}
  <Card className="rounded-3xl border border-slate-200/80 bg-card shadow-sm">
    <CardHeader className="border-b border-slate-100 pb-4">
      <h2 className="text-lg font-bold text-ink">
        Comparison Results Table
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Detail pemeriksaan urutan, keberadaan, status TE, dan Screen Capture.
      </p>
    </CardHeader>

    <CardContent className="space-y-6 pt-5">
      {/* DATA TABLE / EMPTY STATE */}
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
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/80 bg-slate-50/50 p-6 text-center">
          <span className="text-3xl">🔍</span>
          <p className="mt-2 text-xs font-bold text-slate-600">
            Belum ada data untuk ditampilkan
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Masukkan Page ID dan Jira TE di atas, lalu klik Compare.
          </p>
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <ActionFooter
        canFix={canFix}
        loading={loading || busyAction}
        onFix={() => setFixPreviewOpen(true)}
      />
    </CardContent>
  </Card>

  {/* DIALOG: PREVIEW FIX POSITION */}
  <Dialog
    open={fixPreviewOpen}
    title="Preview Fix Position"
    onClose={() => setFixPreviewOpen(false)}
  >
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Perubahan nama/posisi Confluence yang akan diterapkan secara otomatis:
      </p>
      <div className="max-h-60 overflow-auto rounded-2xl border border-slate-200/80 bg-indigo-50 p-4 text-xs font-medium text-slate-800">
        <ul className="space-y-2">
          {rows
            .filter((row) => row.status !== "Extra di Confluence")
            .map((row, index) => (
              <li
                key={row.key}
                className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="font-bold text-brand">
                  {index + 1}. {row.key}
                </span>
                <span className="text-[11px] text-slate-500">
                  Posisi: {row.position < 0 ? "baru" : row.position + 1}{" "}
                  ➔ <strong className="text-slate-800">{index + 1}</strong>
                </span>
              </li>
            ))}
        </ul>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200 text-xs font-bold"
          onClick={() => setFixPreviewOpen(false)}
        >
          Cancel
        </Button>
        <Button
          className="rounded-full bg-brand px-5 text-xs font-bold text-brand-foreground hover:bg-indigo-700"
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

  {/* DIALOG: ADD TEST CASE MODE */}
  <Dialog
    open={Boolean(addModeRow)}
    title={`Add ${addModeRow?.key || "Test Case"}`}
    onClose={() => setAddModeRow(null)}
  >
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Pilih format test case yang akan ditambahkan ke Confluence:
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          className="group rounded-2xl border border-slate-200/80 p-4 text-left shadow-sm transition hover:border-brand hover:bg-indigo-50"
          onClick={() => {
            if (addModeRow) void mutateRow(addModeRow, "add", "expand");
            setAddModeRow(null);
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-brand group-hover:bg-brand group-hover:text-brand-foreground">
            ▾
          </div>
          <strong className="mt-3 block text-xs font-bold text-ink">
            Expand
          </strong>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Table inside Expand section
          </span>
        </button>

        <button
          className="group rounded-2xl border border-slate-200/80 p-4 text-left shadow-sm transition hover:border-brand hover:bg-indigo-50"
          onClick={() => {
            if (addModeRow) void mutateRow(addModeRow, "add", "table");
            setAddModeRow(null);
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-brand group-hover:bg-brand group-hover:text-brand-foreground">
            ▤
          </div>
          <strong className="mt-3 block text-xs font-bold text-ink">
            Without Expand
          </strong>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Direct table placement
          </span>
        </button>
      </div>
    </div>
  </Dialog>
</div>
);

  const getInitialTab = (): NavTab => {
    switch (location.hash) {
      case "#create-sit-page":
        return "create";
      case "#create-tmp-iso":
        return "tmp-iso";
      case "#upload-capture":
        return "upload";
      case "#import-test-case":
        return "import";
      case "#check-sync-te":
        return "check-sync-te";
      default:
        return "home";
    }
  };

  const [activeTab, setActiveTab] = useState<NavTab>(getInitialTab);
  const [syncTab, setSyncTab] = useState<"jira" | "compare">("compare");

  const handleNavClick = (tab: NavTab, hash: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (hash) {
      history.replaceState(null, "", `#${hash}`);
    } else {
      history.replaceState(null, "", window.location.pathname);
    }
  };

  const navItems = [
    {
      id: "home" as NavTab,
      label: "Home Workspace",
      icon: Home,
      hash: "",
      desc: "Overview & Getting Started",
    },
    {
      id: "tmp-iso" as NavTab,
      label: "Create TMP/ISO",
      icon: FileText,
      hash: "create-tmp-iso",
      desc: "Generate TMP/ISO page tree",
    },
    {
      id: "import" as NavTab,
      label: "Import Test Case",
      icon: FileSpreadsheet,
      hash: "import-test-case",
      desc: "Bulk test cases import",
    },
    {
      id: "create" as NavTab,
      label: "Create SIT Page",
      icon: FileText,
      hash: "create-sit-page",
      desc: "Create Confluence SIT Document",
    },
    {
      id: "check-sync-te" as NavTab,
      label: "Check & Sync TE",
      icon: RefreshCw,
      hash: "check-sync-te",
      desc: "Compare Jira execution & Confluence",
    },
    {
      id: "upload" as NavTab,
      label: "Upload Capture",
      icon: ImagePlus,
      hash: "upload-capture",
      desc: "Organize visual evidence",
    },
  ];

  const activeItem = navItems.find((item) => item.id === activeTab) ?? navItems[0];
  const activeNumber = String(
    navItems.findIndex((item) => item.id === activeTab) + 1
  ).padStart(2, "0");

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-ink antialiased">
      {/* SIDEBAR DESKTOP (claude.md §5.1) */}
      <aside className="hidden w-64 flex-col border-r border-line bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:flex">
        <div className="flex h-20 items-center border-b border-line px-6">
          <div>
            <h1 className="font-sans text-lg font-bold tracking-tight text-ink">QPilot</h1>
            <p className="text-[11px] text-slate-500">SIT Generator Workspace</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 p-4">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id, item.hash)}
                className={`group flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-sm transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-brand to-brand-soft font-medium text-brand-foreground shadow-glow"
                    : "text-ink hover:bg-slate-50"
                }`}
              >
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isActive ? "text-brand-foreground/70" : "text-slate-400"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-brand-foreground" : "text-slate-500"
                  }`}
                />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* FOOTER SIDEBAR: profil, ganti tema, logout */}
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 px-1 py-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand to-brand-soft text-xs font-bold text-brand-foreground">
              {(session?.displayName?.trim() || session?.username?.trim() || "QP").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                {[session?.username?.trim(), session?.displayName?.trim()].filter(Boolean).join(" | ") ||
                  "Pengguna QPilot"}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {session?.emailAddress?.trim() || "SIT Generator Workspace"}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((open) => !open)}
                aria-expanded={themeMenuOpen}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
              >
                <Moon className="h-4 w-4" />
                Ganti tema
              </button>
              {themeMenuOpen && <ThemeSwitcher onClose={() => setThemeMenuOpen(false)} />}
            </div>
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate("/login", { replace: true });
              }}
              className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-card px-4 lg:hidden">
          <div>
            <h1 className="text-sm font-black text-ink">QPilot</h1>
            <p className="text-[10px] text-slate-500">SIT Generator Workspace</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5 text-ink" />
          </Button>
        </header>

        {/* MOBILE DRAWER / POPUP MENU */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm lg:hidden">
            <div className="w-4/5 max-w-xs flex-col bg-sidebar p-5 shadow-2xl flex">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="font-bold text-ink text-sm">Navigation</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 flex-1 space-y-1.5">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id, item.hash)}
                      className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-sm ${
                        isActive
                          ? "bg-gradient-to-r from-brand to-brand-soft font-medium text-brand-foreground shadow-glow"
                          : "text-ink hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          isActive ? "text-brand-foreground/70" : "text-slate-400"
                        }`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Icon className={`h-4 w-4 ${isActive ? "text-brand-foreground" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
      <main className="w-full flex-1 max-w-[1400px] mx-auto p-6 md:p-10 font-sans text-ink">
        {/* HEADER PAGE SECTION (claude.md §5.2) */}
        <header className="mb-8 flex items-center gap-5">
          <span className="text-[32px] font-medium leading-none text-brand">
            {activeNumber}
          </span>
          <div className="h-10 w-px bg-line" />
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink">
              {activeItem.label}
            </h1>
            <p className="mt-0.5 font-serif text-sm text-slate-500">{activeItem.desc}</p>
          </div>
        </header>

        {activeTab === "home" ? (
          /* HOME WORKSPACE (Card Grid Dashboard ala Referensi) */
          <div className="space-y-6">

            {/* GRID CONTAINER */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {navItems
                .filter((item) => item.id !== "home")
                .map((item, index) => {
                  const Icon = item.icon;

                  // Palette warna pastel ala gambar referensi
                  const bgVariants = [
                    { cardBg: "bg-slate-50/60", mediaBg: "bg-indigo-50" }, // Accent tint 1
                    { cardBg: "bg-slate-50/60", mediaBg: "bg-indigo-100" }, // Accent tint 2
                    { cardBg: "bg-slate-50/60", mediaBg: "bg-indigo-200/70" }, // Accent tint 3
                    { cardBg: "bg-slate-50/60", mediaBg: "bg-indigo-100/60" }, // Accent tint 4
                  ];
                  const colorStyle = bgVariants[index % bgVariants.length];

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavClick(item.id, item.hash)}
                      className={`group flex cursor-pointer flex-col justify-between rounded-[32px] border border-slate-200/80 ${colorStyle.cardBg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
                    >
                      {/* TOP SECTION: BADGE & ARROW BUTTON */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold leading-tight text-ink">
                            {item.label}
                          </h3>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:bg-brand group-hover:text-brand-foreground">
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </div>

                        {/* TITLE & DESCRIPTION */}
                        <div className="mt-4 space-y-2">
                          
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: MEDIA / ICON CONTAINER */}
                      <div className={`mt-6 flex h-40 w-full items-center justify-center rounded-[24px] ${colorStyle.mediaBg} transition-transform duration-300 group-hover:scale-[1.02]`}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card/80 text-brand shadow-sm backdrop-blur-sm">
                          <Icon className="h-8 w-8" />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : activeTab === "check-sync-te" ? (
          <div className="space-y-6">
            {/* SEGMENTED BUTTON SWITCHER */}
            <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 shadow-inner">
              <Button
                onClick={() => setSyncTab("compare")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  syncTab === "compare"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Compare Jira TE &amp; Confluence
              </Button>
              <Button
                onClick={() => setSyncTab("jira")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  syncTab === "jira"
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Jira TE
              </Button>
            </div>

            {/* VIEW SWITCHING */}
            {syncTab === "jira" ? (
              <JiraTeView
                executionKey={executionKey}
                onChanged={() => void runCompare()}
              />
            ) : (
              compareView
            )}
          </div>
        ) : activeTab === "create" ? (
          <CreateSitPageView />
        ) : activeTab === "tmp-iso" ? (
          <CreateTmpIsoView />
        ) : activeTab === "upload" ? (
          <UploadCaptureView editedImages={editedImages} />
        ) : (
          <ImportTestCaseView />
        )}
      </main>
      </div>

      <Dialog
        open={Boolean(message)}
        title={tone === "error" ? "Gagal" : tone === "success" ? "Berhasil" : "Info"}
        onClose={dismissMessage}
      >
        <p className="text-sm text-ink">{message}</p>
        <div className="mt-5 flex justify-end">
          <Button className="bg-brand text-brand-foreground" onClick={dismissMessage}>OK</Button>
        </div>
      </Dialog>
      <LoadingOverlay open={loading || busyAction} />
    </div>
  );
}