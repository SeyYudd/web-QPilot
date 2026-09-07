# Proposal QIM Vision Q3 — BugPack

> **Judul:** BugPack — Jembatan Replikasi Bug antara QA dan Developer
> **Tema:** Automation Testing (Functional) + Improvement
> **Status:** Draft proposal | **Deadline:** 1 Desember 2026 | **Tim:** Solo (design + dev)
> **Basis teknologi:** fork dari proyek open-source `westpoint-io/mimik` (MIT license, WXT + React + TypeScript) — atribusi sumber dipertahankan sesuai lisensinya

---

## 1. Problem Statement

Setiap bug report di BRI melewati siklus yang sama dan boros waktu:

1. QA menemukan bug, mengambil screenshot, menulis langkah reproduksi manual.
2. Developer mencoba replicate → **tidak kejadian**.
3. QA bilang "kok gak bisa?", dev bilang "gak kejadian di tempat saya".
4. Bolak-balik screenshot, video layar, dan penjelasan chat → berhari-hari.

Akar masalahnya bukan orangnya, tapi **bukti yang tidak bisa dijalankan ulang**. Screenshot itu foto masa lalu — bukan kondisi aplikasi yang hidup. Data yang diketik QA, urutan kliknya, dan state halamannya hilang begitu laporan dikirim.

## 2. Solusi

**BugPack** adalah Chrome extension yang mengubah interaksi QA menjadi **file bukti interaktif (`.bugpack`)** yang bisa dijalankan ulang oleh developer:

```
Sisi QA:
  record → klik & isi form → ekstensi capture otomatis:
    - selector path elemen (fallback: data-testid → role → text → CSS)
    - nilai yang diketik di setiap input
    - screenshot tiap langkah
    - URL & urutan navigasi
  → export 1 file .bugpack → kirim ke dev

Sisi Developer:
  buka extension → drop file .bugpack → tampil ID sesi
  → replay: buka URL yang sama, isi ulang form secara otomatis,
    klik ulang sesuai urutan → dev melihat bug terjadi langsung
  → kalau gak kejadian = informasi berharga (env/data mismatch)
```

### Pembeda dari extension open-source yang jadi basisnya (pertanyaan pasti dari juri)

Basisnya (mimik) adalah **alat dokumentasi** (panduan langkah + screenshot untuk onboarding). Replay-nya "pandu manusia". BugPack adalah **alat replikasi**: menyimpan nilai input, mengisi ulang form otomatis, dan menjalankan ulang interaksi — target penggunanya hubungan QA ↔ Developer, bukan onboarding. BugPack di-fork dari mimik sebagai basis teknologi (MIT); nilai inovasinya ada di lapisan replay & `.bugpack`.

## 3. Scope

### Dipertahankan dari basis fork (sudah jadi)
- Capture klik & typing + screenshot per langkah
- Editor guide: anotasi, crop, blur manual, ubah urutan step
- Version history, salin/duplicate capture
- Export **PDF, DOCX, HTML** (client-side)
- Local-first, tanpa server, tanpa akun — privasi data tertjaga

### Dipotong dari basis fork
- ❌ AI descriptions, voice narration (QA tidak punya server; BRI tidak menyediakan LLM internal)
- ❌ Export Markdown & Video
- ❌ Smart blur otomatis (cukup blur manual)

### Fitur baru (nilai lomba)
1. **`.bugpack` export/import** — satu file berisi langkah + input + screenshot; dev tinggal drop, ID sesi tampil.
2. **Replay otomatis** — refill input + trigger event yang benar untuk SPA (React), selector fallback berjenjang.
3. **Fitur folder** — kelompokkan capture/guide per fitur/proyek; QA menentukan tujuan penyimpanan.
4. **Save All Capture (tanpa caption)** — semua screenshot sesi tersimpan otomatis ke folder pilihan user untuk kebutuhan tertentu (lampiran laporan, dsb.).

## 4. KPI / Dampak terukur

| Metrik | Sebelum | Sesudah (target) |
| --- | --- | --- |
| Waktu dev untuk replicate bug | Berhari-hari (bolak-balik) | < 5 menit (import + replay) |
| Waktu QA menulis langkah reproduksi | Manual per bug | 0 (otomatis dari record) |
| Rate "gak bisa replicate" | Tinggi | Turun drastis — dan ketika gagal, jadi sinyal env/data mismatch |
| Dokumentasi langkah | Screenshot terpisah-pisah | 1 file `.bugpack` + export PDF/DOCX/HTML |

## 5. Demo Flow (untuk hari-H)

1. QA membuka aplikasi internal → klik **Record** → mengisi form multi-step yang berisi bug.
2. Stop record → export `.bugpack` (tunjukkan isi file: langkah, input, screenshot).
3. Ganti peran ke developer → buka extension → **drop file** → ID sesi tampil.
4. **Replay** → form terisi ulang otomatis, klik terjadi ulang → bug muncul persis.
5. Tunjukkan fitur pendukung: folder, Save All Capture, export PDF.

## 6. Timeline (7 Sep – 1 Des, efektif 8 minggu + buffer)

| Minggu | Kerja | Verify |
| --- | --- | --- |
| 1 | Fork + bersihkan (cut AI/voice/MD/video) | Build jalan, fitur sisa tidak rusak |
| 2 | Skema storage + fitur folder | Buat/pindah/hapus folder |
| 3 | Save All Capture → folder | Capture bulk tersimpan di folder tujuan |
| 4–5 | `.bugpack` export/import + ID | QA export → dev import → ID tampil, data utuh |
| 6–7 | Replay otomatis (inti lomba) | Form multi-step terisi & terklik ulang dari file |
| 8 | Demo polish, proposal final, slide | Dry-run demo |

**Fallback plan:** jika replay penuh meledak di minggu 6–7, degradasi ke **replay terpandu** (auto-refill input, dev klik manual dengan highlight elemen berikutnya). Story tetap kuat, risiko turun besar.

## 7. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Laptop kerja BRI tidak mengizinkan sideload extension (MV3) | Cek **sekarang**, sebelum commit; alternatif: demo di environment yang diizinkan |
| Replay gagal karena state/sesi berbeda (login, data awal) | File menyimpan catatan prasyarat ("login sebagai X, data Y"); kegagalan replay = informasi, bukan error |
| Memelihara codebase fork (505 commit) | Potong touchpoint UI fitur yang di-cut sedini mungkin agar sisa kode dipahami penuh |
| Scope creep | Scope dibekukan dari dokumen ini; satu fitur baru = satu fitur dibuang |
