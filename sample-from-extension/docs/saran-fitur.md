# Saran Fitur QPilot

Dokumen ini berisi ide fitur yang dapat dikembangkan untuk QPilot. Semua item
di bawah adalah **saran**, bukan fitur yang sudah tersedia. Kondisi fitur aktif
dan struktur implementasi saat ini ada di
`docs/architecture-foldering.md`.

## Arti Prioritas

| Prioritas | Arti |
|---|---|
| **P0** | Fondasi keamanan, reliability, dan pencegah kehilangan atau duplikasi data. |
| **P1** | Fitur inti yang langsung memperkuat workflow Jira -> SIT -> evidence -> Confluence. |
| **P2** | Peningkatan UX, produktivitas, dan observability untuk fitur yang sudah ada. |
| **P3** | Integrasi dan otomasi tambahan setelah core workflow stabil. |
| **P4** | Fitur lanjutan, intelligence, dan productization. |
| **P5** | Eksperimen dan fitur future-facing yang belum perlu menjadi dependency core. |

## P0 - Fondasi Wajib

### 1. Secure Credential Vault

Ganti penyimpanan password plaintext di `chrome.storage.local` dengan strategi
OAuth, API token yang scoped, atau integrasi SSO resmi. Jika Basic Auth masih
wajib, tambahkan risk acceptance dan warning yang eksplisit di Settings.

### 2. Permission Manager

Tampilkan origin yang dapat diakses extension dan minta izin hanya ketika fitur
dipakai. User dapat melihat, menyetujui, dan mencabut akses target tab/domain.

### 3. Message Schema Validator

Tambahkan kontrak runtime untuk setiap action, termasuk required field,
`operationId`, response shape, error code, dan retryability. Action tidak dikenal
harus ditolak dengan response konsisten.

### 4. Operation Idempotency Center

Gunakan operation manifest untuk seluruh operasi mutasi Jira/Confluence. Retry
atau double-click tidak boleh membuat page, attachment, atau issue duplikat.

### 5. Durable Upload Queue

Ubah queue menjadi state machine yang dapat dipulihkan setelah browser atau
service worker restart:

```text
queued -> preparing -> uploading -> updating-page -> verified
                                  -> retryable -> failed
```

Tambahkan retry failed only, cancel job, pause/resume, dan detail per file.

### 6. IndexedDB Lifecycle Manager

Tambahkan TTL, orphan detection, quota warning, dan cleanup terjadwal untuk blob
upload serta hasil automation yang tidak lagi direferensikan metadata.

### 7. Confluence Conflict Resolver

Saat HTTP 409 terjadi, fetch ulang page, tampilkan perubahan yang berkonflik,
dan minta user memilih merge atau retry. Jangan selalu menimpa versi terbaru
secara otomatis.

### 8. Sensitive Data Guard

Tambahkan satu library redaction untuk Authorization, Cookie, token, password,
OTP, email, nomor telepon, dan data sensitif lain pada log, error, export, serta
preview payload.

### 9. Safe Logout and Data Purge

Sediakan logout yang menghapus credential, queue metadata, IndexedDB blob,
temporary state, dan cached operation result dengan konfirmasi user.

### 10. Automated Regression Harness

Tambahkan test untuk proxy response, URL validation, auth fallback, storage
cleanup, blob lifecycle, queue recovery, parser Confluence, dan idempotency.

### 11. Command and Legacy Action Audit

Petakan atau hapus command manifest yang belum memiliki handler aktif. Selesaikan
nasib context-menu capture legacy agar tidak menampilkan menu yang gagal.

### 12. Capability Detection

Saat koneksi berhasil, deteksi versi Jira/Confluence, issue type, Xray endpoint,
custom field test steps, permission, dan dukungan attachment. Simpan dengan TTL
dan tampilkan fallback manual jika detection gagal.

## P1 - Core QA Workflow

### 1. Evidence Workspace

Gabungkan target dan upload menjadi workspace terpadu dengan alur:

```text
Target -> Evidence -> Preview -> Upload -> Verify
```

Tampilkan page, scenario, expand, test case, file mapping, progress, dan link
hasil pada satu layar.

### 2. Capture from Active Tab

Tambahkan capture visible tab, full page, dan selected area yang aman, dengan
binding `tabId`, `frameId`, dan `operationId` agar target tidak tertukar.

### 3. Screenshot Annotation Editor (Implemented)

Image editor tersedia di Web Generator (`ImageEditorView.tsx`, hash
`#image-editor`): anotasi box/shape/arrow, text, blur/redaction, freehand draw,
crop, undo/redo, dan export PNG/JPEG/WEBP. Integrasi penuh ke flow evidence
upload (pemanggilan langsung dari item capture) masih dapat disempurnakan.

Sediakan anotasi box, arrow, text, blur/redaction, highlight, crop, undo/redo,
dan preset warna sebelum upload evidence.

### 4. Evidence Preview and Diff

Sebelum upload, tampilkan thumbnail, ukuran file, target Confluence, caption,
urutan file, dan preview posisi attachment pada expand section.

### 5. Automatic Evidence Naming

Buat nama file standar berdasarkan project, TE, TC, scenario, step, timestamp,
dan jenis evidence. Sediakan template nama yang dapat dikustomisasi.

### 6. Evidence Mapping Assistant

Bantu memetakan file ke test case menggunakan nama file, urutan, prefix Jira key,
atau pilihan drag-and-drop. Selalu tampilkan review sebelum upload.

### 7. Capture Session Recovery

Jika tab target berpindah, reload, atau capture gagal, simpan session sementara
dan tawarkan resume tanpa mengulang seluruh setup.

### 8. Confluence Structure Repair

Deteksi scenario tanpa expand, duplicate TC macro, nested macro rusak, attachment
orphan, dan table yang tidak sesuai template. Tampilkan repair preview sebelum
mutasi page.

### 9. SIT Template Library

Sediakan template SIT per project atau squad, lengkap dengan field mapping,
header, naming convention, macro structure, dan default content.

### 10. SIT Page Update Mode

Selain Create SIT Page, tambahkan mode update yang dapat menambah TC baru,
menghapus TC obsolete, mempertahankan evidence lama, dan menampilkan diff page.

### 11. Jira Test Execution Workspace (Implemented in 2.0.1)

Workspace sudah tersedia untuk load, add, remove, status/run detail, dan membuka
detail test case di tab Jira. Fitur Reorder Mode, Select All, dan bulk status
update telah dihapus; urutan mengikuti Xray/Jira.

### 12. Test Case Import Wizard (Implemented in 2.0.1)

Import XLSX fixed-format sudah tersedia dengan validasi row, preview, edit popup,
duplicate detection, CREATE NEW/REUSE, repository/execution linking, dan retry
failed only. Mapping wizard fleksibel serta update existing masih backlog.

### 13. Jira Bulk Operation Preview

Sebelum create atau update banyak issue, tampilkan payload per item, field yang
berubah, warning duplicate, dan estimasi jumlah request.

### 14. Failed Item Retry (Implemented in 2.0.1)

Import Test Case menyediakan daftar created/linked/failed dan retry hanya item
gagal. Coverage untuk seluruh operasi bulk masih backlog.

### 15. Defect Report Lite

Mulai dari flow sederhana: screenshot, URL, langkah reproduksi, expected/actual
result, environment, dan create Jira issue. Tambahkan log hanya sebagai opt-in.

## P2 - UX dan Produktivitas

### 1. Unified QPilot Shell

Samakan header, breadcrumb, back button, title, help text, loading, empty,
partial, error, retry, toast, dan confirmation pada semua halaman.

### 2. Recent Operations

Home menampilkan operasi terakhir, upload yang gagal, page terakhir, dan shortcut
untuk melanjutkan draft yang masih valid.

### 3. Operation History

Simpan audit ringkas tanpa credential: feature, target, waktu, status, durasi,
error code, dan link Jira/Confluence.

### 4. Global Search

Cari Jira key, TE, TC, Confluence page ID, scenario, operation ID, dan hasil upload
dari satu search box.

### 5. Keyboard Shortcut Customization

User dapat mengganti shortcut, melihat konflik shortcut, serta menonaktifkan
shortcut tertentu tanpa mengubah manifest manual.

### 6. Dark Mode and Theme

Tambahkan dark mode, compact mode untuk tabel, serta pilihan tema yang hanya
mempengaruhi UI extension tanpa mengubah halaman target.

### 7. Responsive Table Mode

Sediakan column visibility, sticky key column, wrap/expand cell, export CSV, dan
layout mobile untuk tabel test case serta comparison.

### 8. Accessibility Pass

Tambahkan focus management, keyboard drag alternative, aria state, contrast
validation, screen-reader labels, dan shortcut untuk modal.

### 9. Bulk Clipboard Actions

Copy Jira key, scenario summary, comparison result, atau defect summary dalam
format plain text, Markdown, JSON, dan format yang siap ditempel ke chat.

### 10. Smart Defaults

Simpan page ID, space key, TE terakhir, target expand terakhir, dan naming
template sebagai preference non-sensitif dengan tombol reset.

### 11. User Confirmation Policy

User dapat memilih operasi mana yang selalu membutuhkan konfirmasi: upload,
delete expand, remove test, update page, dan create issue.

### 12. Inline Help and Diagnostics

Tambahkan penjelasan error HTTP, permission, auth fallback, endpoint yang dipakai,
dan tombol copy diagnostics tanpa credential.

### 13. Notification Center

Kumpulkan hasil upload, warning, dan failed job dalam panel yang bisa dibaca
kembali, bukan hanya toast yang hilang.

### 14. Import/Export Safe Preferences

Export hanya preference dan template non-sensitif. Credential, cookie, token,
dan blob tidak boleh ikut export.

### 15. Playwright Locator Review

Tampilkan confidence, alasan ranking, dan warning untuk generated class, CSS
complex, nth-child, serta XPath panjang sebelum export.

## P3 - Integrasi dan Otomasi

### 1. Official Jira Xray Adapter

Buat adapter terpisah untuk variasi Xray endpoint dan response Jira Cloud/Server,
sehingga parser TE dan test step tidak bergantung pada satu format.

### 2. Jira Capability Profiles

Simpan profil konfigurasi per Jira instance: project, issue type, status,
custom field, workflow transition, dan Xray mode.

### 3. Confluence Template Profiles

Simpan aturan per space: macro name, layout, table header, attachment placement,
dan naming convention.

### 4. Google Drive/Sheets Connector

Jika masih diperlukan, ganti scraping DOM dengan OAuth/API connector resmi,
dengan import preview dan izin terpisah. Jangan menjadikannya dependency utama.

### 5. Git Repository Export

Export hasil Playwright menjadi file `.spec.ts`, locator file, fixture, dan test
data JSON dengan naming convention yang dipilih user.

### 6. Jira Issue Link Assistant

Sarankan link antara TE, TC, story, defect, dan Confluence page berdasarkan key
yang ditemukan pada data yang sedang diproses.

### 7. CI Evidence Callback

Sediakan format manifest evidence yang dapat dihasilkan pipeline CI lalu diimport
ke QPilot untuk dipreview dan diupload ke Confluence.

### 8. API Diagnostics Page

Buat halaman diagnostik untuk menguji endpoint, status auth, permission, latency,
Xray availability, dan Confluence write access secara aman.

### 9. Environment Profiles

Simpan konfigurasi non-sensitif untuk DEV, SIT, UAT, dan PROD, dengan warning
warna/domain sebelum operasi destructive.

### 10. Jira Transition Assistant

Tampilkan transition yang tersedia untuk issue/test execution dan validasi
permission sebelum mengirim perubahan status.

### 11. Confluence Publish Checklist

Sebelum publish, validasi title, page parent, space, jumlah TC, jumlah evidence,
broken macro, dan link Jira.

### 12. Exportable QA Summary

Buat laporan Markdown/CSV/HTML yang berisi coverage, mismatch, capture status,
upload result, dan link hasil tanpa mengirim data otomatis ke server eksternal.

## P4 - Fitur Lanjutan

### 1. AI-Assisted Test Case Draft

Dari Jira story atau acceptance criteria, buat draft scenario, steps, data, dan
expected result. Semua hasil harus editable dan wajib melalui review user.

### 2. AI-Assisted Defect Summary

Gabungkan screenshot, langkah user, response status, dan optional logs menjadi
draft defect. Redaction harus dilakukan sebelum data dikirim ke provider AI.


### 3. Visual Regression Compareada saran ga fitur apalagi yang bisa ditambah ?


Bandingkan screenshot aktual dengan baseline, beri highlight area berbeda, dan
simpan hasil sebagai evidence. Baseline harus memiliki version dan environment.

### 4. Test Coverage Dashboard

Hitung coverage TC berdasarkan status Jira, keberadaan di Confluence, evidence,
dan hasil execution. Sediakan filter project, squad, sprint, dan TE.

### 5. Locator Stability Score

Nilai locator berdasarkan role, label, test id, text stability, DOM depth,
generated class, dan perubahan antar scan.

### 6. Test Data Recipe Builder

Buat recipe data reusable untuk email, UUID, date, number, phone, address, dan
dependent fields dengan preview serta reset.

### 7. Scenario Parameterization

Satu test case dapat memiliki beberapa dataset dan menghasilkan evidence per
dataset dengan naming dan mapping otomatis.

### 8. Approval Workflow

Tambahkan draft -> review -> approved -> published untuk SIT page, evidence
upload, atau bulk Jira mutation.

### 9. Team Template Sharing

Bagikan template SIT, naming rule, locator policy, dan Jira field mapping melalui
repository atau endpoint internal yang terkontrol.

### 10. Audit Export

Export audit trail terstruktur untuk kebutuhan QA Lead tanpa credential, cookie,
raw token, atau data sensitif.

### 11. Browser Session Profiles yang Aman

Jika session manager dihidupkan kembali, batasi profile per origin, tambahkan
expiry, confirmation, domain warning, dan jangan izinkan export credential tanpa
proteksi tambahan.

### 12. Offline Draft Mode

User dapat menyusun test case, mapping evidence, dan template saat offline lalu
menjalankan validation sebelum sinkronisasi ketika koneksi kembali.

## P5 - Eksperimen dan Future Features

### 1. Cross-Browser Support

Evaluasi Edge dan Firefox setelah API permission, injection, storage, dan capture
flow Chrome memiliki contract test yang stabil.

### 2. Desktop Companion App

Gunakan native helper untuk desktop capture penuh, secure credential storage,
atau akses filesystem yang lebih kuat. Extension tetap menjadi UI/browser bridge.

### 3. Local AI Model

Gunakan model lokal untuk membuat test draft, locator explanation, atau defect
summary tanpa mengirim data perusahaan ke layanan cloud.

### 4. Autonomous Test Flow Builder

Dari user journey, QPilot menyusun langkah Playwright, data setup, assertion,
dan evidence checkpoint. Selalu hasilkan draft yang wajib direview.

### 5. Smart Failure Clustering

Kelompokkan failed execution berdasarkan error message, endpoint, screenshot
similarity, dan test area untuk membantu triage.

### 6. Release Risk Scoring

Gabungkan test failure, missing evidence, unresolved defect, dan perubahan story
untuk memberi indikasi risiko release.

### 7. Natural Language QA Search

User dapat mencari dengan kalimat seperti “test yang gagal di payment minggu
ini”, lalu QPilot menerjemahkannya menjadi filter Jira yang dapat direview.

### 8. Automatic Change Impact Analysis

Hubungkan perubahan Jira story, test case, UI locator, dan evidence untuk
menyarankan test yang perlu dijalankan ulang.

### 9. Team Analytics Opt-In

Ukur waktu capture-to-upload, recovery rate, dan failure pattern hanya dengan
consent eksplisit, anonymization, dan retention policy.

### 10. Extension Plugin API

Sediakan API plugin terbatas agar tim dapat menambahkan formatter, template,
validator, atau adapter tanpa memodifikasi core extension.

## Rekomendasi Urutan Implementasi

1. P0: keamanan credential, permission, contract message, queue, dan test harness.
2. P1: Evidence Workspace, capture yang aman, preview, update SIT, dan bulk retry.
3. P2: unified shell, operation history, accessibility, diagnostics, dan locator review.
4. P3: adapter Jira/Confluence, environment profile, API diagnostics, dan CI import.
5. P4: AI, visual regression, coverage analytics, dan approval workflow.
6. P5: eksperimen hanya setelah reliability, security, dan telemetry opt-in siap.
