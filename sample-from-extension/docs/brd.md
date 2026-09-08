# Business Requirements Document

## QPilot - QA Workflow Pilot

| Item | Nilai |
|---|---|
| Versi dokumen | 2.0.1 |
| Status | Current product baseline, September 5, 2026 |
| Platform | Google Chrome Extension, Manifest V3 |

## 1. Tujuan Bisnis

QPilot membantu QA membuat dokumentasi SIT, memeriksa sinkronisasi test case
Jira-Confluence, mengunggah evidence, menemukan locator Playwright, dan melakukan
utility task tanpa berpindah dari browser.

Nilai utama release saat ini adalah pengurangan kerja manual pada alur
Jira Test Execution -> SIT Confluence -> evidence upload.

## 2. Scope Release Saat Ini

| Area | Capability tersedia |
|---|---|
| SIT Web Generator | Create SIT Page dari Jira TE, edit/reorder test case, generate child page Confluence, import Test Case XLSX bulk ke Jira/Xray, generate page tree TMP/ISO (Create TMP/ISO), dan verifikasi token `{{...}}` pada tree TMP/ISO (Verify TMP/ISO). |
| TE synchronization | Compare Jira TE dengan macro test case Confluence, preview Fix Position, add/remove SIT, dan workspace Jira TE untuk membership/status/detail. |
| Evidence | Fetch scenario/expand, add-edit-delete expand, upload file lokal PNG/JPEG/WebP melalui queue background, dan image editor (crop, draw, shape, text, blur, export). |
| Playwright | DOM scan, hover-direct, hover-wait, locator extraction, code/result export XLSX/PDF/DOCX. |
| Utilities | File generator, dummy data filler, text/mock generator. |
| Confluence shortcuts | Image resize, expand/collapse, bulk text formatting, table formatting. |
| Access | Settings, URL normalization, Basic Auth validation dengan cookie fallback SSO. |
| Import Test Case | Download template SheetJS, preview/validasi/edit row, CREATE NEW/REUSE, repository/execution linking, progress log, dan retry failed only. |

## 3. Di Luar Scope Release Ini

Fitur berikut masih berupa histori, legacy code, atau backlog dan tidak boleh
dipresentasikan sebagai capability aktif:

- Defect reporting dan screen recording end-to-end.
- Jira Test Plan/Test Case generator dan vanilla Jira dashboard.
- SIT template v1/v2 berbasis Excel sebagai halaman terpisah.
- Google Drive evidence import.
- Quick Notes, auto-login manager, dan session manager.
- Static global content script untuk capture atau logging.

## 4. Stakeholders dan Outcome

| Stakeholder | Outcome yang diharapkan |
|---|---|
| QA Engineer | SIT dan evidence selesai lebih cepat dengan lebih sedikit copy-paste. |
| QA Lead | Dapat melihat mismatch TE dan Confluence sebelum publish. |
| Automation Engineer | Mendapat locator dan test block awal dari halaman aktif. |
| Developer | Menerima struktur test/evidence Confluence yang konsisten. |

## 5. Business Requirements

| ID | Requirement | Status |
|---|---|---|
| BR-01 | User dapat memuat Jira Test Execution dan test case terkait. | Available |
| BR-02 | User dapat membuat child SIT page Confluence dengan test case yang diedit. | Available |
| BR-03 | User dapat membandingkan urutan/keberadaan test case Jira dan Confluence. | Available |
| BR-04 | User dapat memperbaiki posisi dengan preview serta add/remove macro dari Compare; Jira TE mengelola membership dan status. | Available |
| BR-05 | User dapat memilih scenario dan nested expand section sebagai target evidence. | Available |
| BR-06 | User dapat upload batch file lokal dengan progress dan hasil per file. | Available |
| BR-06a | User dapat mengedit image (crop, draw, shape, text, blur) sebelum upload/export. | Available |
| BR-12 | User dapat generate page tree TMP/ISO dari konfigurasi project dan memverifikasi token `{{...}}` yang belum terisi. | Available |
| BR-07 | Sistem menyimpan blob besar di IndexedDB dan queue metadata di local storage. | Available |
| BR-08 | User dapat scan halaman dan export hasil locator Playwright. | Available |
| BR-09 | Settings memvalidasi Jira dan Confluence melalui service worker. | Available |
| BR-10 | Defect capture, Drive import, Jira bulk generator, dan session tools tersedia. | Not in current baseline |
| BR-11 | User dapat import bulk Test Case dari spreadsheet dengan preview, validasi, CREATE/REUSE, dan hasil per baris. | Available |

## 6. Constraints and Risks

- Hanya Chrome MV3 yang didukung.
- Host permission masih luas (`http://*/*`, `https://*/*`).
- Credential disimpan plaintext di `chrome.storage.local`.
- Basic Auth dan cookie fallback dipakai; OAuth belum tersedia.
- Upload evidence pada Web Generator hanya menerima file lokal image PNG/JPEG/WebP.
- Context-menu capture dan beberapa command manifest masih legacy/unmapped.
- Tidak ada test runner/integration test; verifikasi utama adalah smoke check, build,
  dan uji manual.

## 7. Success Measures

Target bisnis lama seperti pengurangan waktu 70% belum diukur secara telemetry.
Release ini sebaiknya diukur dengan baseline manual vs QPilot untuk:

1. Waktu membuat SIT page dari satu TE.
2. Waktu menemukan dan memperbaiki mismatch TE-Confluence.
3. Waktu upload evidence per test case.
4. Jumlah upload yang gagal atau perlu diulang.
