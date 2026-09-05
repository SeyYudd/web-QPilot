# Design System & Visual Guidelines (QPilot Workspace)

## Overview

QPilot Design System mengusung konsep **Soft, Clean, & Elegant UI**. Antarmuka ini mengombinasikan warna pastel kebiruan yang lembut (*soft sky/periwinkle*) dengan aksen biru elegan, kartu putih melayang (*floating card*), serta tipografi editorial berserif untuk *heading* guna memberikan impresi yang bersih, modern, dan profesional.

---

## Colors

- **Surface Background** (`#E0E9FD`): Latar belakang utama aplikasi (*soft periwinkle/sky blue*).
- **Surface Card / Container** (`#FFFFFF`): Kartu melayang, panel *form*, dan kontainer utama.
- **Color Text Main** (`#000000`): Warna teks utama untuk keterbacaan yang jelas dan kontras.
- **Color Primary / Accent** (`#2563EB`): Warna biru utama untuk tombol aktif, interaksi utama, dan *brand highlight*.
- **Color Secondary / Muted Accent** (`#6089E4`): Warna biru sedang untuk indikator sekunder, *hover state*, dan sub-elemen.
- **Color Border / Divider** (`#AEC4F5`): Garis pembatas tipis, *border* input, dan *divider* yang lembut.
- **Color Input Background** (`#FFFFFF`): Isian field input token dan teks.

---

## Typography

Sistem tipografi menggunakan kombinasi **Serif Editorial** untuk *heading* utama demi kesan elegan, serta **Sans-Serif Modern** untuk UI/Body text agar mudah dibaca (*high readability*).

- **Display / Editorial Font**: Playfair Display / Georgia / Times New Roman (Serif)
- **UI / Body Font**: Inter / Plus Jakarta Sans / system-ui (Sans-Serif)

### Typography Scale
- **text-hero-display**: Serif 42px – 48px, Regular / Medium, line-height 1.2 (*"Tempat buat Bikin sama Upload Jira dan Confluence"*)
- **text-h1**: Serif 28px – 32px, Medium, line-height 1.25 (*"Connect your tools"*)
- **text-label**: Sans-Serif 12px – 13px, Medium, `#6089E4`
- **text-body**: Sans-Serif 14px – 15px, Regular, `#000000`, line-height 1.5
- **text-caption**: Sans-Serif 12px, Regular, `#6089E4` (*"Get Started"*)
- **text-button**: Sans-Serif 14px, SemiBold / Medium, tracking-wide

---

## Spacing & Geometry

Sistem tata letak menggunakan skala berbasis **8px grid** dengan pendekatan ruang bernapas yang luas (*generous padding & margins*).

- **space-1**: 4px — Tight spacing
- **space-2**: 8px — Label to input gap
- **space-3**: 16px — Form field item gaps
- **space-4**: 24px — Card inner padding (small)
- **space-5**: 32px – 40px — Main card inner padding
- **space-6**: 64px — Hero left-to-right section spacing

---

## Border Radius

Penerapan sudut melengkung yang sangat lembut (*ultra-smooth rounded corners*) untuk menjaga estetika ramah dan modern:

- **radius-input**: 20px – 24px (Pill-shaped input fields)
- **radius-card**: 28px – 32px (Large floating card container)
- **radius-button**: 12px – 20px (Soft rounded interactive buttons)

---

## Elevation & Depth

- **Card Shadow**: `0px 20px 40px -15px rgba(37, 99, 235, 0.08)` — Memberikan efek kartu melayang dengan bayangan biru lembut yang sangat halus.
- **Input Border**: Border tipis `#AEC4F5` dengan fokus ring halus `#2563EB`.

---

## Components

### 1. Landing Hero Text (Left Section)
- Menggunakan tipografi Serif berefek editorial dengan warna `#000000`.
- Alignment rata kiri dengan lebar maks ~450px.
- Menjelaskan *core value*: tempat pembuat dan pengunggah dokumentasi Jira & Confluence secara terintegrasi.

### 2. Login / PAT Connect Card (Right Section)
- **Container**: Card putih bersih (`#FFFFFF`) dengan padding luas (~40px), *border-radius* 28px, dan bayangan *soft elevation*.
- **Header**: Teks caption *"Get Started"* (`#6089E4`) di atas judul Serif *"Connect your tools"* (`#000000`), dipisahkan oleh garis tipis *divider* (`#AEC4F5`).
- **Inputs (Jira & Confluence PAT)**:
  - Label mungil di atas field (`Jira`, `Confluence`) berwarna `#6089E4`.
  - Shape: *Full Pill Rounded* (24px radius).
  - Background putih dengan border halus `#AEC4F5`.
  - Placeholder: `"Personal Access Token"`.
- **Primary Action Button**:
  - Teks: `"Enter Workspace"`.
  - Gaya: Minimalis elegan bergaris bawah atau tombol *rounded* dengan background `#2563EB` dan teks `#FFFFFF`.

---

## Do's and Don'ts

1. **Do** gunakan kombinasi warna `#E0E9FD` dan `#FFFFFF` untuk menciptakan kontras *soft* yang tidak melelahkan mata.
2. **Don't** gunakan warna hitam pekat yang dominan di area latar; gunakan `#000000` hanya untuk tipografi teks agar tetap tegas.
3. **Do** gunakan warna `#AEC4F5` untuk pembatas (*border/divider*) agar tampilan tetap halus dan terstruktur.
4. **Don't** menambahkan gradasi warna mencolok yang merusak kesan elegan dan minimalis.
5. **Do** pastikan tombol utama menggunakan warna `#2563EB` saat memerlukan penekanan aksi (*call-to-action*).

---

## Implementation Status (September 2026)

Design system ini **sudah diimplementasikan** ke seluruh view `src/pages`
(Dashboard, Create SIT Page, Create TMP/ISO, Verify TMP/ISO, Check & Sync TE,
Jira TE View, Upload Capture, Image Editor) dan komponen UI primitives
(`src/components/ui/`). Pemetaan token ke kode:

| Token design.md | Implementasi kode |
|---|---|
| `#E0E9FD` Surface Background | `colors.canvas` di `tailwind.config.ts`; `bg-canvas`; body & CSS var `--bg-canvas` di `src/styles/tailwind.css` |
| `#2563EB` Primary | `colors.brand` / `colors.indigo.600` (`bg-brand`, `indigo-600`, CSS var `--brand-primary`) |
| `#6089E4` Secondary | `colors.accent` / `colors.indigo.400` / `colors.muted` (`text-muted`, CSS var `--text-muted`) |
| `#AEC4F5` Border | `colors.line` / `colors.indigo.200` (`border-line`, CSS var `--border-subtle`) |
| Serif heading | `fontFamily.serif` = Playfair Display / Georgia; semua heading view memakai `font-serif` |
| Sans body | `fontFamily.sans` = Inter / Plus Jakarta Sans |
| radius-card 28px | `Card` di `src/components/ui/card.tsx` memakai `rounded-[28px]` |
| radius-button 12px | `Button` di `src/components/ui/button.tsx` memakai `rounded-xl` |
| radius-input 20–24px | Field input view memakai `rounded-2xl` |
| Card shadow floating | `boxShadow.panel` = `0 20px 40px -15px rgba(37, 99, 235, 0.08)` (`shadow-panel`) |

Catatan teknis: palet `indigo` dan `slate` di `tailwind.config.ts` sengaja
di-remap ke token resmi di atas, sehingga seluruh class Tailwind existing
(`indigo-*`, `slate-*`) otomatis konsisten tanpa rewrite massal. Palet slate
di-tint periwinkle lembut; `ink` = `#000000` hanya untuk tipografi. Animasi
`animate-fadeIn` juga didefinisikan di `src/styles/tailwind.css`.