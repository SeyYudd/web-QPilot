# QPilot Architecture and Folder Structure

## Current Snapshot

- **Version:** 2.0.1 (manifest and package)
- **Updated:** September 5, 2026 (revisi: Web Generator menambah menu Create TMP/ISO, Verify TMP/ISO, dan Image Editor; design system "Soft, Clean, & Elegant UI" dari `docs/design.md` diterapkan ke seluruh view `src/pages` via design token Tailwind)
- **Platform:** Google Chrome Extension, Manifest V3
- **Build:** Vite + React + TypeScript + Tailwind CSS
- **Source of truth:** `public/manifest.json`

Dokumen ini menggambarkan repository saat ini. Dokumen BRD/SRS berisi tujuan dan
spesifikasi, bukan daftar fitur yang seluruhnya sudah tersedia.

## 1. Runtime Structure

```text
extension-QIM-Confluence-Jira/
|- background.js                 # MV3 service worker dan message hub
|- index.html / index.js         # popup home
|- dashboard.html                # Web Generator, full tab React
|- session-check.js              # guard untuk halaman privat
|- content.js                    # legacy capture/content runtime
|- public/manifest.json          # satu-satunya manifest
|- scripts/smoke-check.js        # validasi developer
|- vite.config.ts / tsconfig.json / package.json
|- src/
|  |- pages/Dashboard.tsx        # Home Workspace + nav semua tab Web Generator
|  |  |- create-sit-page/       # Create SIT Page view + lib
|  |  |- create-tmpi-so/        # Create TMP/ISO (form, generate, hasil) + lib types/generate/verify
|  |  |- verify-tmpiso/         # Verify TMP/ISO (scan token belum terisi + TagFixPanel)
|  |  |- check-sync-te/         # Compare Jira TE & Confluence
|  |  |- jira-te/               # Jira TE View (add/remove/status)
|  |  |- upload-capture/        # Upload Capture evidence
|  |  `- ImageEditorView.tsx    # Image editor canvas (crop, draw, shape, text, blur, undo/redo)
|  |- components/                # dashboard dan UI primitives
|  |  `- dashboard/ImportTestCaseView.tsx # XLSX preview dan bulk import Jira
|  |- hooks/useCompareLogic.ts   # compare dan update Jira/Confluence
|  |- lib/                       # Jira, Confluence, utility TypeScript
|  |- types/                     # tipe dashboard
|  |- entry/                     # redirect dashboard.html ke dist/dashboard.html
|  |- background/                # auth, HTTP boundary, network tracking
|  |- shared/                    # proxy client, IndexedDB, storage policy
|  |- sit/                       # image resizer dan SIT HTML builder
|  |- automation/                # Playwright scanner/inspector/exporter
|  |- settings/                  # login dan konfigurasi
|  |- tools/                     # quick tools dan shortcut Confluence
|  `- assets/                    # CSS klasik, icon, SheetJS
`- docs/
```

`dist/` adalah output build dan tidak menjadi sumber dokumentasi. Vite menyalin
file runtime root dan seluruh `src/` ke `dist/`, serta menyalin manifest dari
`public/`.

## 2. User-Facing Modules

| Menu | Entry point | Status dan fungsi |
|---|---|---|
| Aksi Halaman (Live Assist) | `src/live-assist.html` | Public, dibuka sebagai `chrome.sidePanel`. Navigasi pills (pola Toolbox `sp-tabs`): Dummy Data (default) dan Playwright. Dummy Data inject `dummy-data-content.js` ke tab aktif. Pill Playwright memuat seluruh UI scan Playwright langsung di panel (orkestrasi oleh `src/automation/playwright-panel.js`, tanpa login) — lihat baris Playwright di bawah. |
| Web Generator | `dashboard.html` | Private. Home Workspace, Create SIT Page, Create TMP/ISO, Verify TMP/ISO, Check & Sync TE (+ Jira TE View), Upload Capture, Import Test Case, dan Image Editor (hash `#image-editor`). Dibuka sebagai tab. |
| Playwright | `src/live-assist.html` (pill Playwright, `src/automation/playwright-panel.js`) | Public (tanpa login — murni baca DOM halaman target, tidak menyentuh Jira/Confluence). Scan DOM dan hover picker berbasis rule (appear) langsung di side panel; tidak ada lagi halaman `playwright-gen.html`. Mode dipilih lewat dropdown; tiap locator diberi skor stabilitas (High/Medium/Low), validasi uniqueness, fallback chain, deteksi context shadow/iframe, drill-down naik/turun DOM, rescan stability check, dan export XLSX/PDF/DOCX + `.spec.ts`. Tab target diambil dari `qpilotLiveAssistTarget`. |
| Toolbox | `src/tools/toolbox.html` | Public, dibuka sebagai `chrome.sidePanel`. Switcher internal untuk JSON Formatter, Text Diff, Encoder/JWT, Files Generator, Bagi-Bagi Angka, dan Text Generator. |
| JSON Formatter | `src/tools/toolbox.html` (#tool-json) | Public. Format/minify/validate JSON. Standalone `json-formatter.html` masih ada namun popup masuk lewat Toolbox. |
| Text Diff | `src/tools/toolbox.html` (#tool-diff) | Public. Bandingkan dua blok teks baris per baris (LCS). Standalone `text-diff.html` masih ada. |
| Encoder / JWT | `src/tools/toolbox.html` (#tool-encoder) | Public. Base64 encode/decode, URL-encode/decode, dan JWT decode (header+payload, tanpa verifikasi signature). |
| Files Generator | `src/tools/toolbox.html` (#tool-files) & `src/tools/file-generator.html` | Public. Generate file (csv/svg/txt/json/jpg/png/zip/rar) untuk didownload saja — tanpa injeksi ke input file halaman. |
| Bagi-Bagi Angka | `src/tools/toolbox.html` (#tool-angka) | Public. Generator pemecah angka: input total + jumlah baris + tipe (bulat/desimal), menghasilkan N baris angka acak yang jumlahnya sama dengan total. |
| Text Generator | `src/tools/text-generator.html` | Public. Lorem, alpha, numeric, alphanumeric, special. (versi Toolbox ada di #tool-textgen) |
| Dummy Data | `src/tools/dummy-data-filler.html` | Public. Inject on demand untuk mengisi field, termasuk radio, checkbox, select, dan datepicker. Entri popup utama kini via Live Assist. |
| Regex Tester | `src/tools/regex-tester.html` | Public. Test regex, tampilkan match & capture group, replace. |
| Image Resizer | `src/sit/sit-auto-resize-image.html` | Public shortcut Confluence. |
| Expand / Collapse | `src/tools/expand-collapse.html` | Public shortcut Confluence. |
| Bulk Text Formatter | `src/tools/auto-strikethrough.html` | Public shortcut Confluence. |
| Table Formatter | `src/tools/table-formatter.html` | Public shortcut Confluence. |
| Settings | `src/settings/settings.html` | Login, URL configuration, connection validation. |

Tidak ada lagi entry point aktif untuk Jira dashboard vanilla, SIT generator
vanilla, defect report, Quick Notes, auto-login manager, atau session manager.

## 3. Manifest and Access

Manifest memakai permission `storage`, `tabs`, `activeTab`, `scripting`,
`notifications`, `contextMenus`, `webRequest`, `downloads`, `cookies`,
`commands`, dan `sidePanel`. Host permission saat ini adalah `https://*/*` dan
`http://*/*`. `side_panel.default_path` diarahkan ke `src/tools/toolbox.html`;
popup memakai `chrome.sidePanel.setOptions({ path })` + `chrome.sidePanel.open()`
(dengan `WINDOW_ID_CURRENT`) untuk membuka Toolbox dan Live Assist.

Tidak ada `content_scripts` statis. Script scanner, inspector, dan dummy-data
di-inject on demand dengan `chrome.scripting.executeScript`; default world-nya
ISOLATED. `MAIN` world hanya boleh digunakan jika kebutuhan page context jelas.

Keyboard commands yang dideklarasikan:

| Command | Shortcut | Fungsi |
|---|---|---|
| `open-web-generator` | Alt+Shift+1 | Membuka Web Generator (`dashboard.html`) pada tab baru. |
| `fill-dummy-data` | Alt+Shift+2 | Mengisi form pada tab aktif dengan Dummy Data (inject `dummy-data-content.js` lalu kirim `qpilot_fill_dummy_data`). |
| `expand-all-sections` | Alt+Shift+3 | Membuka semua section expand pada halaman Confluence (View mode). |


### 4.1 Service Worker Message Hub

Handler utama berada di `background.js`. Action yang aktif pada listener utama:

| Action | Caller | Fungsi |
|---|---|---|
| `validate_connection` | `src/settings/settings.js` | Validasi Jira `/rest/api/2/myself` dan Confluence `/rest/api/space?limit=1`. Basic Auth dicoba lebih dulu, lalu cookie session pada 401/403. |
| `proxy_fetch` | `src/shared/api-client.js` | Proxy HTTP(S) untuk halaman extension, timeout 90 detik, parsing JSON/text, metadata status dan retryability. |
| `start_background_upload` | `Dashboard.tsx` | Memulai queue upload evidence dari state `sitUploadState`. |
| `qpilot_automation_item` | `playwright-inspector.js` | Menyimpan record picker secara serial ke IndexedDB dan metadata storage. |

Listener terpisah di `src/background/network-service.js` menangani
`get_network_headers` dan `clear_network_headers`. Context-menu capture masih
mengirim action legacy ke tab, tetapi tidak ada content script statis yang
menjamin action tersebut dilayani; flow itu harus dianggap legacy/berisiko.

### 4.2 API Boundary

`src/shared/api-client.js` hanya menjadi client halaman. Ia membuang header
credential lalu mengirim `proxy_fetch`. `src/background/api-client.js` hanya
berjalan di service worker; ia mengambil credential melalui
`auth-service.js`, memakai `credentials: include`, timeout 90 detik, dan
mencoba ulang tanpa Authorization untuk sesi SSO.

Response proxy normal berbentuk:

```js
{
  success: true,
  operationId: "api_...",
  status: 200,
  ok: true,
  data: {},
  error: null,
  errorCode: null,
  retryable: false,
  url: "https://..."
}
```

Credential tetap disimpan plaintext di `chrome.storage.local`; storage browser
bukan credential vault.

## 5. Storage

Persistent configuration: `jiraUrl`, `confUrl`, `user`, dan `pass`.

Persistent per-host key `qpilotPwStability` menyimpan snapshot signature elemen
Playwright untuk rescan stability check (sengaja tidak di-clear harian).

Transient UI/job state meliputi `lastPage`, `lastClearedDate`,
`qpilotAutomationResults`, `qpilotOperationResults`, `sitUploadState`,
`sitUploadResult`, capture state, dashboard draft state, dan bug-report metadata.
Daftar authoritative transient key berada di
`src/shared/storage-policy.js` dan dipakai oleh background serta popup.

Payload besar tidak seharusnya masuk `chrome.storage.local`. Implementasi
`src/shared/blob-store.js` memakai IndexedDB database `qpilot-blobs`, object store
`payloads`; storage local hanya memegang `blobKey` dan metadata queue.

`chrome.storage.sync` tidak dipakai oleh fitur aktif saat ini.

## 6. Main Flows

### Create TMP/ISO

User mengisi identitas project (`TmpIsoProjectConfig`): ID/nama project, nama
fungsi/aplikasi/modul, onboarding date, lokasi template root page, target space
dan parent page, serta kumpulan link Jira/Confluence (SIT/UAT/DAST/NCM/SOP).
Sistem menyalin master page tree TMP/ISO (node `root`, `01`–`05` beserta
sub-halamannya, lihat `lib/page-tree.ts`), mengisi placeholder `{{...}}`
berdasarkan fill rules (`lib/fill-rules.ts`), membuat halaman Confluence dan
link terkait, lalu menampilkan Execution Report (`GenerateResultView.tsx`) berisi
donut success ratio, KPI berhasil/gagal, dan daftar hasil per halaman dengan
aksi Check Again / Persist untuk halaman yang belum tuntas.

### Verify TMP/ISO

User memasukkan Root Page ID tree TMP/ISO di Confluence. Sistem memindahkan
seluruh tree (`scanTreeFromRoot` di `create-tmpi-so/lib/verify.ts`), menemukan
token `{{...}}` yang belum terisi, dan menampilkannya pada `TagFixPanel`.
User dapat memperbaiki token secara instan; perbaikan dipersist ke Confluence
(`persistFixes`) lalu tree di-scan ulang.

### Image Editor

Dibuka pada hash `#image-editor` (window popup terpisah dari Upload Capture).
Menerima image via postMessage (`qpilot-image-edit-source`), menyediakan
crop, freehand draw, shape (rect/circle/line/arrow), text, blur
(gaussian/box/pixelate), rotate/flip, undo/redo (history stack), dan
delete. Hasil dikembalikan ke opener via postMessage
(`qpilot-image-edit-result`) atau diexport lokal sebagai PNG/JPEG/WEBP.

### Create SIT Page

User memasukkan Confluence space key, parent page ID, dan Jira Test Execution
key. Dashboard memuat TE dan test case Xray, membaca `customfield_11404`
atau field bernama test steps, memberi kesempatan edit/reorder/add/remove,
menghasilkan storage HTML melalui `sit-template-builder.js`, lalu membuat child
page Confluence. Jika judul child sudah ada, operasi dihentikan dan user diminta
mengubah judul.

### Check and Sync TE

Dashboard membandingkan urutan test case Jira/Xray dengan macro test case di
Confluence, menampilkan status Match/Missing/Extra/Urutan berbeda dan status
capture. User dapat memperbaiki posisi dengan preview, menambah/menghapus macro
melalui kolom Action, serta mengelola membership/status/detail pada Jira TE.

### Import Test Case

`ImportTestCaseView.tsx` membuat template XLSX dengan SheetJS, membaca dua baris
header dan grup Manual Test Steps dinamis, lalu menampilkan preview tervalidasi.
Setiap row dapat dipilih, diedit, diproses sebagai CREATE NEW atau REUSE, dan
dikirim sequentially. Menghapus row otomatis meng-re-number No agar tetap urut
1..n, dan setelah upload XLSX sukses halaman auto-scroll ke tabel preview
(`import-preview-table`). Modal konfirmasi ditutup langsung dan tiap row
di-update asynchronously in-place di tabel saat diproses secara sequential;
badge Status (Processing/Uploaded/Failed) dan kolom Link Jira (Loading...,
hyperlink issue, atau `- ⚠`) diperbarui per baris tanpa menunggu seluruh batch.
Tombol Detail membuka expandable row untuk payload/response (success) atau
error log (failed). Retry Failed Only hanya muncul setelah batch selesai bila
ada row berstatus failed.

Pada CREATE NEW, Test Type di-set Manual via `customfield_11400: { id: "10801" }`
agar field Manual Steps aktif, dan steps dikirim sebagai `customfield_11404`
dengan struktur Xray Server `{ steps: [{ index, fields: { Action, Data, "Expected
Result" } }] }` (format diverifikasi dari issue existing Jira). Jika Jira menolak
steps saat create, request di-degrade tanpa `customfield_11404`; jika
assignee/labels/description juga ditolak, dipakai hanya field dasar, lalu steps
diisi ulang melalui PUT `/rest/api/2/issue/{key}`.

### Upload Capture

User memasukkan Confluence page ID, memuat scenario dan nested expand section,
lalu dapat add/edit/delete expand. File lokal PNG/JPEG/WebP dipreview dan
direorder. File disimpan sebagai blob IndexedDB, metadata queue ditulis ke
`sitUploadState`, kemudian queue service worker mengunggahnya dengan progress,
retry per file, dan hasil sukses/gagal.

### Playwright Generator

Playwright Generator berjalan **di dalam Live Assist side panel** (pill
Playwright, orkestrasi di `src/automation/playwright-panel.js` yang di-load
`src/live-assist.html`). Tidak ada lagi halaman terpisah
halaman generator terpisah. Panel meng-inject `playwright-scanner.js` lalu
`playwright-inspector.js` ke tab web target (dari `qpilotLiveAssistTarget`,
tanpa query param `?tabId=` karena tidak ada perpindahan tab), dan
mengkonsumsikan hasilnya lewat pesan runtime. Mode dipilih melalui **satu
dropdown** (`scan-all` / `hover-direct`) — bukan tombol terpisah. Fitur ini
tidak menyentuh Jira/Confluence sehingga tidak mensyaratkan login.

Fitur maturity berbasis rule/heuristik deterministik (tanpa AI/LLM):

- **Skor stabilitas locator** (`computeLocatorStability`): `getByTestId` >
  `getByRole`/`getByLabel` > CSS id > CSS class > XPath. Pola class
  auto-generated (prefix `css-`/`sc-`/`jss-`/`js-`/`app-`, akhiran digit) dan
  `:nth-child/:nth-of-type` atau XPath/traversal panjang menurunkan skor dan
  memunculkan warning. Ditampilkan sebagai badge High/Medium/Low.
- **Uniqueness validation** (`evaluateUniqueness`): `document.querySelectorAll`
  dan `document.evaluate` pada DOM halaman target untuk menghitung jumlah match
  CSS/XPath; 0 atau >1 match → warning eksplisit sebelum save/export.
- **Fallback chain** (`collectCandidateLocators`): beberapa kandidat per elemen
  (test-id, role+name, label, CSS, XPath). Export `.spec.ts` menyusunnya sebagai
  chain Playwright `.or()`; ekspor XLSX/PDF/DOCX menampilkan semuanya.
- **Contex shadow/iframe** (`getContextInfo`): elemen dalam Shadow DOM atau
  iframe ditandai dan diberi catatan eksplisit; picker menampilkan hitungan
  iframe dan peringatan bahwa klik di iframe tidak terekam dari dokumen utama.
- **Drill-down saat hover-pick** (`arrow-up/down` keyboard): naik/turun level
  DOM di titik yang disorot tanpa menggeser mouse, berguna untuk elemen bertumpuk.
- **Rescan stability check** (`qpilotPwStability`, persistent per-host): snapshot
  signature elemen; bila scan ulang halaman yang sama menghasilkan lebih sedikit
  signature, ditampilkan peringatan kemungkinan locator tidak stabil.
- **Export `.spec.ts`** (`QPilotExporter.exportSpecTs`): template statis
  Playwright siap pakai (bukan generate AI).

Tombol info (`i`) di header pill dan kontrol non-trivial membuka penjelasan
singkat dengan pola konsisten **expand in-place** + tombol Tutup.

## 7. External APIs

| Sistem | Endpoint yang digunakan saat ini |
|---|---|
| Jira | `/rest/api/2/myself`, `/rest/api/2/issue`, `/rest/api/2/issue/{key}`, `/rest/raven/1.0/api/testexec/{key}/test`, `/rest/raven/1.0/api/testrun`, `/rest/raven/1.0/api/testrun/{id}/status`, `/rest/raven/1.0/api/testrepository/{project}/folders/{id}/tests` |
| Confluence | `/rest/api/space?limit=1`, `/rest/api/content/{id}`, `/rest/api/content/{parent}/child/page`, `/rest/api/content` untuk create/update dan attachment flow queue |
| Google/CDN | Digunakan oleh Files Generator sesuai URL sample; bukan dependency Web Generator |

## 8. Build and Verification

```bash
npm install
node scripts/smoke-check.js
npm run build
```

Smoke check membaca `public/manifest.json`, memeriksa referensi manifest,
syntax JavaScript, dan larangan inline `<style>` pada HTML. Extension dijalankan
dari folder `dist/` melalui `chrome://extensions`.

## 9. Maintenance Rules

1. Tambahkan halaman baru ke `src/<module>/`, routing popup, guard bila private,
   dan dokumentasi ini.
2. Tambahkan action background hanya pada listener utama, kecuali direct message
   yang memang khusus injected script atau listener network.
3. Untuk handler async, selalu `return true` sebelum callback selesai.
4. Update `storage-policy.js` bila menambah transient key.
5. Jangan mengklaim fitur BRD/SRS sebagai tersedia tanpa entry point dan caller
   aktif yang dapat diverifikasi di source.
