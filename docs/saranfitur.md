# Saran Fitur — QPilot

> Prioritas: **P0** (harus, gap fungsional/bug) → **P1** (berdampak besar, murah) → **P2** (nice to have) → **P3** (tunda sampai ada permintaan nyata).
> Dasar: temuan di `docs/BRD.md`, `docs/SRS.md`, dan struktur kode saat ini.

---

## P0 — Wajib (gap fungsional & bug yang sudah terdokumentasi)

| # | Item | Jenis | Detail |
|---|------|-------|--------|
| 1 | **SIT page body builder versi web** | Fitur (gap) | Saat ini body HTML SIT page disusun oleh extension (`window.QPilotSitTemplateBuilder`), sehingga di web-app mode halaman Confluence dibuat **kosong**. Implementasikan builder di sisi web agar fitur utama benar-benar berfungsi tanpa extension. |
| 2 | **Fix PAT mismatch di Check & Sync TE** | Bug | Confluence reads masih lewat `createJiraClient` (pakai Jira PAT, bukan Confluence PAT). Latent bug tercatat di SRS → berpotensi 401/403 saat baca Confluence. |
| 3 | **Validasi CORS/proxy di deployment produksi** | Infra | BRD menyatakan proxy Vite hanya dev-time; produksi butuh reverse-proxy rule setara. Tanpa ini semua integrasi gagal saat deploy. |

---

## P1 — Berdampak besar, biaya rendah

| # | Item | Jenis | Detail |
|---|------|-------|--------|
| 4 | **Preview sebelum publish ke Confluence** | UX/Fitur | Tampilkan preview storage-format HTML sebelum tombol `Generate SIT PAGE` dieksekusi. Mencegah publish salah dan rework. (Sudah "planned" di SRS.) |
| 5 | **Draft & retry untuk publish yang gagal** | UX | Simpan payload publish terakhir di IndexedDB; jika request gagal, tawarkan tombol "Retry publish" alih-alih mengisi ulang form dari nol. |
| 6 | **Update halaman Confluence yang sudah ada** | Fitur | Search page + update dengan optimistic concurrency (increment `version`). Sekarang hanya create → publish ulang membuat duplikat halaman. (Sudah "planned" di BRD.) |
| 7 | **Feedback progres integrasi yang jelas** | UX | Untuk operasi Jira/Confluence yang panjang (import banyak test case), tampilkan progres per-item ("3/10 berhasil…") dan ringkasan gagal-beserta-alasan di akhir, bukan hanya toast sukses/gagal. |
| 8 | **Empty state & error state yang konsisten** | UX | Setiap module view punya pola empty state (belum ada data) dan error state (jaringan mati) yang seragam, dengan tombol aksi (retry / buka setup PAT). |

---

## P2 — Nice to have

| # | Item | Jenis | Detail |
|---|------|-------|--------|
| 9 | **Persistensi draft form Create SIT Page** | UX | Simpan input Space Key, Parent Page ID, TE Key terakhir per user di localStorage agar tidak diketik ulang tiap sesi. |
| 10 | **Impor test case dari spreadsheet dengan mapping kolom** | Fitur | Saat ini `xlsx` dipakai untuk impor; tambahkan langkah preview/mapping kolom sebelum create issue di Jira, sehingga salah format terdeteksi sebelum menulis ke Jira. |
| 11 | **Riwayat aktivitas lokal** | Fitur | Log lokal (IndexedDB) berisi aksi remote terakhir: publish ke mana, import apa, kapan. Membantu audit tanpa backend. |
| 12 | **Queue capture di Upload Capture** | UX | Daftar screenshot yang menunggu di-attach, bisa dianotasi dulu lalu di-upload batch saat online kembali. |
| 13 | **Shortcut keyboard di editor gambar** | UX | Undo/redo, crop, teks via keyboard (Ctrl+Z, Ctrl+Shift+Z, dll.) untuk mempercepat anotasi. |

---

## P3 — Tunda (spekulatif, kerjakan hanya jika ada permintaan nyata)

| # | Item | Alasan ditunda |
|---|------|----------------|
| 14 | Dashboard analytics/adopsi | Butuh sumber data & belum ada pemanggil KPI. |
| 15 | Kolaborasi multi-user / shared drafts | Bertentangan dengan prinsip "client-only, tanpa backend" di BRD. |
| 16 | Export multi-format (PDF/Word) | Belum ada use case terkonfirmasi. |
| 17 | Template SIT page customizable | Menambah konfigurasi yang belum diminta; risiko over-engineering. |

---

## Catatan

- Urutan kerja yang disarankan: **P0 (1–3) → P1 (4, 5, 6)**.
- Setiap item P0/P1 harus punya success criteria terverifikasi sebelum dikerjakan (mis. item 1: SIT page terpublish berisi konten dari web-app tanpa extension).
