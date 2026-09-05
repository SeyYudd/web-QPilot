import { useEffect, useState } from "react";
import ImageEditorView from "./ImageEditorView";
import CheckSyncTeView from "./check-sync-te/CheckSyncTeView";
import CreateSitPageView from "./create-sit-page/CreateSitPageView";
import CreateTmpIsoView from "./create-tmpi-so/CreateTmpIsoView";
import UploadCaptureView from "./upload-capture/UploadCaptureView";
import VerifyTmpIsoView from "./verify-tmpiso/VerifyTmpIsoView";
import { ImportTestCaseView } from "../components/dashboard/ImportTestCaseView";
import "../styles/tailwind.css";

export function App() {
  if (location.hash === "#image-editor") return <ImageEditorView />;

  const [editedImages, setEditedImages] = useState<Record<string, string>>({});

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

  const initialTab =
    location.hash === "#create-sit-page"
      ? "create"
      : location.hash === "#create-tmp-iso"
      ? "create-tmp-iso"
      : location.hash === "#check-sync-te"
      ? "check-sync-te"
      : location.hash === "#upload-capture"
      ? "upload"
      : location.hash === "#import-test-case"
      ? "import"
      : location.hash === "#verif-tmp-iso"
      ? "verif-tmp-iso"
      : "home";

  type TabKey =
    | "home"
    | "create"
    | "create-tmp-iso"
    | "verif-tmp-iso" // Tambahkan tipe ini
    | "check-sync-te"
    | "upload"
    | "import";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const NAV_ITEMS: { key: TabKey; label: string; hash: string; icon: string }[] = [
    { key: "home", label: "Home Workspace", hash: "", icon: "🏠" },
    { key: "create-tmp-iso", label: "Create TMP/ISO", hash: "create-tmp-iso", icon: "📄" },
    { key: "verif-tmp-iso", label: "Verify TMP/ISO", hash: "verif-tmp-iso", icon: "✅" },
    { key: "create", label: "Create SIT Page", hash: "create-sit-page", icon: "📄" },
    { key: "import", label: "Import Test Case", hash: "import-test-case", icon: "📋" },
    { key: "upload", label: "Upload Capture", hash: "upload-capture", icon: "🖼️" },
    { key: "check-sync-te", label: "Check & Sync TE", hash: "check-sync-te", icon: "🔄" },
  ];

  const navigateTab = (key: TabKey, hash: string) => {
    setActiveTab(key);
    history.replaceState(null, "", hash ? `#${hash}` : "/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-canvas text-slate-800 font-sans antialiased">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sticky top-0 h-screen w-64 flex-shrink-0 border-r border-slate-200/80 bg-white flex flex-col justify-between p-4 shadow-sm z-20">
        <div className="space-y-8">
          {/* BRANDING HEADER */}
          <div className="flex items-center justify-between px-2 pt-2">
            <div>
              <h1 className="text-base font-serif font-semibold text-slate-900 tracking-tight">
                QPilot
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                SIT Generator Workspace
              </p>
            </div>
            <button
              onClick={() => window.close()}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              title="Close Workspace"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* MENU ITEMS */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map(({ key, label, hash, icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigateTab(key, hash)}
                  className={`w-full text-left rounded-2xl px-3.5 py-3 text-xs font-bold transition-all duration-200 flex items-center justify-between group ${
                    isActive
                      ? "bg-[#6366f1] text-white shadow-md shadow-indigo-200"
                      : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm opacity-90">{icon}</span>
                    <span>{label}</span>
                  </div>
                  <span
                    className={`text-xs transition-transform duration-200 ${
                      isActive ? "text-white opacity-100" : "text-slate-400 opacity-60 group-hover:translate-x-0.5"
                    }`}
                  >
                    ›
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* MAIN VIEW CONTAINER */}
      <main className="flex-1 overflow-y-auto px-10 py-10 max-w-[1400px]">
        {/* VIEW 0: HOME WORKSPACE */}
        {activeTab === "home" ? (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h1 className="text-xl font-serif font-medium text-slate-900 inline-flex items-center gap-3">
                Home Workspace
                <span className="text-xs font-semibold text-muted font-sans font-normal border-l border-line pl-3">
                  Overview & Quick Access
                </span>
              </h1>
            </div>

            {/* HOME GRID CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* CARD 1: CREATE SIT PAGE */}
              <div
                onClick={() => navigateTab("create", "create-sit-page")}
                className="group cursor-pointer rounded-3xl bg-white p-6 shadow-panel border border-indigo-200/60 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 flex flex-col justify-between h-[280px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-serif font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Create SIT Page
                    </h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all text-xs font-bold">
                      ↗
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Create Confluence SIT Document
                  </p>
                </div>
                <div className="h-36 rounded-2xl bg-[#DCE9FE] flex items-center justify-center">
                  <div className="h-10 w-10 rounded-xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 text-lg">
                    📄
                  </div>
                </div>
              </div>

              {/* CARD 2: CREATE TMP/ISO */}
              <div
                onClick={() => navigateTab("create-tmp-iso", "create-tmp-iso")}
                className="group cursor-pointer rounded-3xl bg-white p-6 shadow-panel border border-indigo-200/60 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 flex flex-col justify-between h-[280px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-serif font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Create TMP/ISO
                    </h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all text-xs font-bold">
                      ↗
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Generate TMP/ISO page tree
                  </p>
                </div>
                <div className="h-36 rounded-2xl bg-[#E3ECFC] flex items-center justify-center">
                  <div className="h-10 w-10 rounded-xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 text-lg">
                    📄
                  </div>
                </div>
              </div>

              {/* CARD 3: CHECK & SYNC TE */}
              <div
                onClick={() => navigateTab("check-sync-te", "check-sync-te")}
                className="group cursor-pointer rounded-3xl bg-white p-6 shadow-panel border border-indigo-200/60 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 flex flex-col justify-between h-[280px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-serif font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Check & Sync TE
                    </h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all text-xs font-bold">
                      ↗
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Compare Jira execution & Confluence
                  </p>
                </div>
                <div className="h-36 rounded-2xl bg-[#DCE9FE] flex items-center justify-center">
                  <div className="h-10 w-10 rounded-xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 text-lg">
                    🔄
                  </div>
                </div>
              </div>

              {/* CARD 4: UPLOAD CAPTURE */}
              <div
                onClick={() => navigateTab("upload", "upload-capture")}
                className="group cursor-pointer rounded-3xl bg-white p-6 shadow-panel border border-indigo-200/60 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 flex flex-col justify-between h-[280px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-serif font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Upload Capture
                    </h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all text-xs font-bold">
                      ↗
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Organize visual evidence
                  </p>
                </div>
                <div className="h-36 rounded-2xl bg-[#E3ECFC] flex items-center justify-center">
                  <div className="h-10 w-10 rounded-xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 text-lg">
                    🖼️
                  </div>
                </div>
              </div>

              {/* CARD 5: IMPORT TEST CASE */}
              <div
                onClick={() => navigateTab("import", "import-test-case")}
                className="group cursor-pointer rounded-3xl bg-white p-6 shadow-panel border border-indigo-200/60 hover:shadow-xl hover:shadow-indigo-200/50 transition-all duration-300 flex flex-col justify-between h-[280px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-serif font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Import Test Case
                    </h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all text-xs font-bold">
                      ↗
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Bulk test cases import
                  </p>
                </div>
                <div className="h-36 rounded-2xl bg-[#DCE9FE] flex items-center justify-center">
                  <div className="h-10 w-10 rounded-xl bg-white/80 shadow-sm flex items-center justify-center text-indigo-600 text-lg">
                    📋
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "check-sync-te" ? (
          <CheckSyncTeView />
        ) : activeTab === "create" ? (
          <CreateSitPageView />
        ) : activeTab === "upload" ? (
          <UploadCaptureView editedImages={editedImages} />
        ) : activeTab === "create-tmp-iso" ? (
          <CreateTmpIsoView />
        ) : activeTab === "verif-tmp-iso" ? (
          <VerifyTmpIsoView />
        ) : (
          <ImportTestCaseView />
        )}
      </main>


    </div>
  );
}
document.getElementById("root")!.replaceChildren();
import("react-dom/client").then(({ createRoot }) =>
  createRoot(document.getElementById("root")!).render(<App />),
);
