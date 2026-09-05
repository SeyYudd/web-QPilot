# Software Requirements Specification

## QPilot - Current Technical Baseline

| Item | Nilai |
|---|---|
| Versi | 2.0.1 |
| Updated | September 5, 2026 (Create TMP/ISO, Verify TMP/ISO, Image Editor, penerapan design system docs/design.md) |
| Platform | Chrome Manifest V3 |

Dokumen ini adalah spesifikasi implementasi yang berjalan. Requirement lama
untuk modul yang sudah dihapus dipindahkan menjadi backlog, bukan kontrak runtime.

## 1. Architecture

Popup `index.html` membuka halaman fitur. `dashboard.html` adalah aplikasi React
full-tab dan memakai Tailwind. Halaman klasik memakai HTML/JS dan global CSS.
`background.js` adalah MV3 service worker yang memuat modul dengan
`importScripts()`.

Private page hanya `dashboard.html`; guard berada di `session-check.js`.
Live Assist, Toolbox, shortcut Confluence, dan quick tools saat ini public.

## 2. Functional Requirements

### FR-01 Web Generator

- Memuat TE Jira dan memastikan issue type adalah `Test Execution`.
- Membaca test keys dari Xray endpoint dan detail issue dari Jira.
- Memetakan test steps dari `customfield_11404` atau field berlabel steps.
- Menambah, edit, hapus, dan drag-reorder test case/step sebelum generate.
- Membuat child page Confluence memakai storage representation.
- Menolak judul child yang sudah ada.

### FR-02 Check and Sync TE

- Membandingkan test case Jira dengan macro test case Confluence.
- Menghasilkan status `Match`, `Urutan berbeda`, `Missing di Confluence`, dan
  `Extra di Confluence` serta status capture.
- Menawarkan Fix Position dengan preview/konfirmasi serta Add/Remove macro di
  kolom Action; Compare tidak lagi menyediakan Mark atau bulk status mutation.
- Mengelola add/remove test pada Jira Test Execution.
- Jira TE menampilkan status Test Run Xray (pill badge), assignee, dan Detail ke
  Jira. Fitur Reorder Mode, Select All, dan bulk status telah dihapus; urutan
  selalu mengikuti urutan Xray/Jira.

### FR-03 Upload Capture

- Memuat root expand sebagai scenario dan nested expand sebagai target.
- Menambah, edit, dan menghapus target expand melalui update page Confluence.
- Menerima file lokal image PNG, JPEG, dan WebP.
- Menyimpan setiap file sebagai blob IndexedDB sebelum queue dimulai.
- Menampilkan progress sukses/gagal dan mempertahankan metadata queue di
  `sitUploadState`.

### FR-04 Import Test Case

- Menghasilkan template `Scenario - Jira test Repository.xlsx` secara dinamis
  dengan SheetJS; file template tidak disimpan di repository.
- Membaca dua baris header, termasuk grup Action/Data/Expected Result dinamis,
  trim value, skip row kosong, dan memvalidasi Project, Test ID, Summary,
  Assignee, Repository Path, mode REUSE, serta minimal satu step CREATE NEW.
- Menampilkan preview dengan checkbox Include/Exclude dan popup Edit per row.
- Menjalankan CREATE NEW atau REUSE secara sequentially, menghubungkan test ke
  repository dan optional Test Execution; modal konfirmasi ditutup langsung dan
  hasil tiap baris tampil asynchronous in-place di tabel preview (badge Status
  dan kolom Link Jira) tanpa modal status terpisah, berdasarkan hasil
  `created`, `linked`, atau `failed`.
- Pada CREATE NEW, set Test Type = Manual via `customfield_11400: { id: "10801" }`
  dan simpan Manual Steps sebagai `customfield_11404` dengan struktur Xray Server
  `{ steps: [{ index, fields: { Action, Data, "Expected Result" } }] }`
  (dikonfirmasi dari issue existing Jira BRI).
- Bila create ditolak, field yang bermasalah dihapus secara berjenjang
  (steps, lalu assignee/labels/description), dan steps diisi ulang melalui PUT
  `/rest/api/2/issue/{key}`.
- Setelah batch selesai, user dapat menjalankan Retry Failed Only.

### FR-05 Playwright Generator

- Berjalan di pill Playwright pada `src/live-assist.html`, bukan halaman generator terpisah.
- Menjalankan scan DOM dan hover-direct dari side panel; mode dipilih melalui dropdown.
- Menghasilkan locator berdasarkan role, label, test id, CSS, atau XPath.
- Memvalidasi uniqueness, memberi skor stabilitas, membuat fallback chain, dan mendeteksi shadow DOM/iframe.
- Menyimpan record picker melalui service worker bila panel/tab target berubah.
- Mengekspor hasil ke XLSX, PDF, DOCX, `.spec.ts`, dan code preview.

### FR-06 Tools dan Settings

- File generator mendukung mode Blob/CDN/Inject sesuai implementasi tool.
- Dummy data dan shortcut Confluence diinjeksi saat user membuka tool.
- Settings menyimpan URL/credential dan meminta `validate_connection`.
- Validasi mencoba Basic Auth lalu cookie session pada HTTP 401/403.

### FR-07 Create TMP/ISO

- Menerima konfigurasi project (`TmpIsoProjectConfig` di
  `src/pages/create-tmpi-so/lib/types.ts`): identitas project/fungsi/aplikasi/
  modul, onboarding date, template root page ID, target space & parent page,
  serta link Jira/Confluence (SIT/UAT/DAST/NCM/SOP, opsional Bug List).
- Menyalin master page tree TMP/ISO (node `root`, `01`–`05` beserta
  sub-halaman, `lib/page-tree.ts`) dan mengisi placeholder `{{...}}`
  berdasarkan fill rules (`lib/fill-rules.ts`).
- Menampilkan Execution Report (`GenerateResultView.tsx`): donut success ratio,
  KPI berhasil/gagal, hasil per halaman, dengan aksi Check Again / Persist.

### FR-08 Verify TMP/ISO

- Scan tree TMP/ISO dari Root Page ID Confluence (`scanTreeFromRoot`,
  `src/pages/create-tmpi-so/lib/verify.ts`).
- Menemukan dan menampilkan token `{{...}}` yang belum terisi pada
  `TagFixPanel`.
- Memperbaiki token secara instan dan mempersist ke Confluence
  (`persistFixes`), lalu scan ulang tree.

### FR-09 Image Editor

- Dibuka pada hash `#image-editor` sebagai window terpisah; komunikasi dengan
  Upload Capture via postMessage (`qpilot-image-edit-source` /
  `qpilot-image-edit-result`).
- Tools: select/move, freehand draw, shape (rect/circle/line/arrow), text,
  blur (gaussian/box/pixelate), crop dengan handle, rotate/flip.
- Undo/redo berbasis history stack; delete item terpilih (keyboard Delete/
  Backspace didukung).
- Save kembali ke opener, atau export lokal PNG/JPEG/WEBP dengan quality
  setting.

## 3. Message Contracts

Background actions: `validate_connection`, `proxy_fetch`,
`start_background_upload`, dan `qpilot_automation_item`.

Network listener actions: `get_network_headers` dan `clear_network_headers`.
Action automation lainnya adalah direct message antara halaman generator dan
script yang di-inject.

`proxy_fetch` memiliki timeout 90 detik dan response metadata
`operationId/status/ok/data/errorCode/retryable/url`. URL non-HTTP(S) ditolak.

## 4. Data and Security

- `jiraUrl`, `confUrl`, `user`, `pass` berada di `chrome.storage.local` dan
  plaintext; browser profile harus diperlakukan sensitif.
- Feature page tidak boleh mengirim `Authorization`, `Cookie`, atau
  `Set-Cookie`; auth policy dimiliki service worker.
- Blob besar berada di IndexedDB `qpilot-blobs/payloads`.
- Transient local keys harus didaftarkan di `src/shared/storage-policy.js`.
- Network tracker menghapus credential headers dan query/hash URL sebelum state
  disimpan.

## 5. External Interfaces

| Sistem | Endpoint utama |
|---|---|
| Jira | `/rest/api/2/myself`, `/rest/api/2/issue`, `/rest/api/2/issue/{key}`, `/rest/raven/1.0/api/testexec/{key}/test`, `/rest/raven/1.0/api/testrun`, `/rest/raven/1.0/api/testrun/{id}/status`, `/rest/raven/1.0/api/testrepository/{project}/folders/{id}/tests` |
| Confluence | `/rest/api/space?limit=1`, `/rest/api/content/{id}`, `/rest/api/content/{id}/child/page`, `/rest/api/content` |
| Chrome | storage, tabs, activeTab, scripting, contextMenus, webRequest, downloads, cookies, commands, notifications |

## 6. Reliability Behavior

- Proxy request abort setelah 90 detik.
- Queue memakai `operationId`, attempt counter, dan retryable status.
- Daily cleanup menghapus transient metadata dan blob yang direferensikan queue
  atau bug-report.
- Service worker startup mereset upload lock dan menjalankan migrasi key `qexa`
  ke namespace `qpilot`.
- Dialog status untuk flow dashboard memakai kategori Berhasil/Gagal/Info,
  menampilkan HTTP status dan tombol OK; operasi berjalan memakai modal Loading.
- Fitur Reorder Jira TE (bersama Select All dan bulk status) telah dihapus.
  Fix Position pada Compare sepenuhnya mengikuti urutan Xray/Jira dan key basi
  `qpilot_jira_te_order_*` dibersihkan dari storage saat load/compare.

## 7. Verification

```bash
node scripts/smoke-check.js
npm run build
```

Smoke check tidak menggantikan pengujian browser. Minimum manual check mencakup
login, Create SIT, Import Test Case (template, validasi, create/reuse, repository
link, retry), Compare/Sync TE, Upload Capture, Playwright, dan seluruh menu public.
