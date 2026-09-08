# QPilot Workspace Design System

## 1. Overview

QPilot Design System mengusung konsep:

> **Clean, Minimal, & Soft Modern Dashboard**

Antarmuka mengombinasikan:
* Canvas latar belakang ultra-soft periwinkle/off-white yang sangat bersih (pada Light mode) atau deep dark charcoal (pada Dark mode).
* Sidebar navigasi ramping dengan pembatas garis tipis (*subtle border*).
* Aksen aktif berpendar (*glowing gradient badge*) untuk penanda menu terpilih sesuai skema warna yang aktif.
* Tipografi gabungan Modern Sans-Serif (untuk nomor & navigasi UI) dan Editorial Serif (untuk heading utama).
* Floating Card dengan *soft neutral shadow* (tanpa bayangan hitam pekat).

---

## 2. Color System & Multi-Theme Engine

Aplikasi mendukung **2 Mode Latar Belakang (Light & Dark)** dan **3 Pilihan Skema Warna Aksen (Orange Sunset, Ocean Blue, Soft Coral)**.

---

### 2.1 CSS Variables Specification

#### Base Animations & Shadows
```css
/* Soft neutral floating card shadow (tanpa bayangan hitam pekat) */
--shadow-panel: 0px 20px 40px -15px rgba(10, 10, 12, 0.06);

/* Subtle, short entrance animation */
--animate-fadeIn: fadeIn 0.3s ease-out both;

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

```

---

#### 2.1.1 Theme Accent 1: Sunset Orange (Default)

##### Light Mode (`data-theme="orange-light"`)

```css
:root[data-theme="orange-light"] {
  --color-canvas: #F8F9FE;       /* surface-background */
  --color-sidebar: #FFFFFF;      /* surface-sidebar */
  --color-brand: #FF7A00;        /* active-orange-start — primary accent */
  --color-brand-soft: #FF9E66;   /* active-orange-end — gradient end */
  --color-line: #E2E8F0;         /* border-subtle */
  --color-ink: #0A0A0C;          /* text-main */
  --color-muted: #64748B;        /* text-muted */

  /* Color Ramp */
  --color-indigo-50: #FFF4EA;
  --color-indigo-100: #FFE9D6;
  --color-indigo-200: #FFD9BF;
  --color-indigo-300: #FFC29C;
  --color-indigo-400: #FF9E66;
  --color-indigo-500: #FF8A40;
  --color-indigo-600: #FF7A00;
  --color-indigo-700: #E86C00;
  --color-indigo-800: #C25400;
  --color-indigo-900: #9C4300;
}

```

##### Dark Mode (`data-theme="orange-dark"`)

```css
:root[data-theme="orange-dark"] {
  --color-canvas: #0F172A;       /* deep dark canvas */
  --color-sidebar: #1E293B;      /* dark sidebar surface */
  --color-brand: #FF7A00;        /* primary accent */
  --color-brand-soft: #FF9E66;   /* gradient end */
  --color-line: #334155;         /* dark border-subtle */
  --color-ink: #F8FAFC;          /* light text-main */
  --color-muted: #94A3B8;        /* light text-muted */

  /* Color Ramp */
  --color-indigo-50: #2A1A0E;
  --color-indigo-100: #3D2210;
  --color-indigo-200: #5C3214;
  --color-indigo-300: #8F4911;
  --color-indigo-400: #FF9E66;
  --color-indigo-500: #FF8A40;
  --color-indigo-600: #FF7A00;
  --color-indigo-700: #FF9333;
  --color-indigo-800: #FFB366;
  --color-indigo-900: #FFD4A8;
}

```

---

#### 2.1.2 Theme Accent 2: Ocean Blue (`#6089E4`)

##### Light Mode (`data-theme="blue-light"`)

```css
:root[data-theme="blue-light"] {
  --color-canvas: #F4F7FF;
  --color-sidebar: #FFFFFF;
  --color-brand: #6089E4;        /* primary accent */
  --color-brand-soft: #8FAEFF;   /* gradient end */
  --color-line: #E2E8F0;
  --color-ink: #0A0A0C;
  --color-muted: #64748B;

  /* Color Ramp */
  --color-indigo-50: #EFF4FE;
  --color-indigo-100: #DBE5FE;
  --color-indigo-200: #BFD3FE;
  --color-indigo-300: #9BBBFB;
  --color-indigo-400: #8FAEFF;
  --color-indigo-500: #6D98F4;
  --color-indigo-600: #6089E4;
  --color-indigo-700: #4B6EC5;
  --color-indigo-800: #38539A;
  --color-indigo-900: #293B6E;
}

```

##### Dark Mode (`data-theme="blue-dark"`)

```css
:root[data-theme="blue-dark"] {
  --color-canvas: #0B132B;
  --color-sidebar: #1C2541;
  --color-brand: #6089E4;
  --color-brand-soft: #8FAEFF;
  --color-line: #2A385B;
  --color-ink: #F8FAFC;
  --color-muted: #8D99AE;

  /* Color Ramp */
  --color-indigo-50: #101B3B;
  --color-indigo-100: #182854;
  --color-indigo-200: #233975;
  --color-indigo-300: #3350A0;
  --color-indigo-400: #8FAEFF;
  --color-indigo-500: #6D98F4;
  --color-indigo-600: #6089E4;
  --color-indigo-700: #7DA2FF;
  --color-indigo-800: #9EBDFF;
  --color-indigo-900: #C7DAFF;
}

```

---

#### 2.1.3 Theme Accent 3: Soft Coral / Peach (`#FFB6A6`)

##### Light Mode (`data-theme="coral-light"`)

```css
:root[data-theme="coral-light"] {
  --color-canvas: #FFF9F8;
  --color-sidebar: #FFFFFF;
  --color-brand: #FFB6A6;        /* primary accent */
  --color-brand-soft: #FFD4CB;   /* gradient end */
  --color-line: #E2E8F0;
  --color-ink: #0A0A0C;
  --color-muted: #64748B;

  /* Color Ramp */
  --color-indigo-50: #FFF5F3;
  --color-indigo-100: #FFEAE6;
  --color-indigo-200: #FFD4CB;
  --color-indigo-300: #FFC0B3;
  --color-indigo-400: #FFB6A6;
  --color-indigo-500: #FA9F8E;
  --color-indigo-600: #E88876;
  --color-indigo-700: #C26453;
  --color-indigo-800: #9C4536;
  --color-indigo-900: #782C1E;
}

```

##### Dark Mode (`data-theme="coral-dark"`)

```css
:root[data-theme="coral-dark"] {
  --color-canvas: #1A1211;
  --color-sidebar: #2A1D1B;
  --color-brand: #FFB6A6;
  --color-brand-soft: #FFD4CB;
  --color-line: #3D2B28;
  --color-ink: #FAF0EE;
  --color-muted: #A8928E;

  /* Color Ramp */
  --color-indigo-50: #2B1815;
  --color-indigo-100: #42211C;
  --color-indigo-200: #633028;
  --color-indigo-300: #8A4338;
  --color-indigo-400: #FFB6A6;
  --color-indigo-500: #FFC2B5;
  --color-indigo-600: #FFD1C7;
  --color-indigo-700: #FFE0D9;
  --color-indigo-800: #FFECE8;
  --color-indigo-900: #FFF7F5;
}

```

---

## 3. Typography

### 3.1 Font Families

* **Heading / Display:** `Plus Jakarta Sans`, `Inter`, `sans-serif`
* **Editorial Accent:** `Playfair Display`, `Georgia`, `serif`
* **Body & UI Navigation:** `Plus Jakarta Sans`, `Inter`, `system-ui`

### 3.2 Hierarchy

| Token | Specification | Usage |
| --- | --- | --- |
| `text-page-number` | Sans, 32–36px, Medium, `var(--color-brand)` | Angka urutan halaman di header |
| `text-page-title` | Sans, 28–32px, SemiBold, `var(--color-ink)` | Judul modul utama |
| `text-section-title` | Serif/Sans, 18–20px, Regular, `var(--color-ink)` | Sub-judul / Deskripsi atas |
| `text-nav-item` | Sans, 14–15px, Medium/Regular | Menu navigasi sidebar |

---

## 4. Layout & Theme Switcher Component Flow

### 4.1 Sidebar Layout

* **Header Sidebar:** Logo "QPilot" di bagian atas dengan sub-teks "SIT Generator Workspace" warna muted.
* **Navigation Items:** Setiap item diawali dengan penomoran dua digit (`01`, `02`, `03`, dst.).
* **Active Indicator:** Item aktif dibungkus *pill badge* membulat penuh (`rounded-full` atau `rounded-xl`) dengan gradient berpendar `var(--color-brand)` ke `var(--color-brand-soft)`.
* **Footer Sidebar:** Profil pengguna (foto avatar + PN + nama), tombol **"Ganti Tema"**, dan tombol "Logout" di posisi paling bawah.

---

### 4.2 Theme Switcher Popover Flow & UI Spec

Ketika pengguna mengklik tombol **"Ganti Tema"** di sidebar footer, sebuah modal/popover kecil muncul dengan alur dan tata letak berikut:

```text
+------------------------------------------+
|  Ganti Tema                              |
|                                          |
|  LIGHT MODE                              |
|  [ O ] [ O ] [ O ]                       |
|  Sunset  Ocean  Coral                    |
|                                          |
|  DARK MODE                               |
|  [ O ] [ O ] [ O ]                       |
|  Sunset  Ocean  Coral                    |
+------------------------------------------+

```

#### Color Swatch Circle Buttons Specification

Setiap pilihan tema diwakili oleh tombol lingkaran (*swatch button*) berukuran `28px x 28px` dengan border halus:

1. **Light Group:**
* **Sunset Orange:** Circle dengan background `#FF7A00` + inner border `#FFFFFF`
* **Ocean Blue:** Circle dengan background `#6089E4` + inner border `#FFFFFF`
* **Soft Coral:** Circle dengan background `#FFB6A6` + inner border `#FFFFFF`


2. **Dark Group:**
* **Sunset Orange:** Circle dengan background `#FF7A00` + outer dark outline `#0F172A`
* **Ocean Blue:** Circle dengan background `#6089E4` + outer dark outline `#0B132B`
* **Soft Coral:** Circle dengan background `#FFB6A6` + outer dark outline `#1A1211`



#### State Indicator (Active Theme)

Tema yang sedang aktif akan ditandai dengan **ring/outline tebal 2px** berwarna `var(--color-brand)` di sekeliling lingkaran swatch, serta tanda centang (*checkmark icon*) kecil di tengah lingkaran.

---

## 5. Do's and Don'ts

### Do

* Gunakan variabel CSS (`var(--color-*)`) secara konsisten pada semua komponen agar transisi tema berjalan secara instan.
* Simpan pilihan tema pengguna ke dalam `localStorage` (misal: `theme: "blue-dark"`) agar pilihan tidak hilang saat *refresh* halaman.
* Pastikan kontras teks tetap sesuai standar aksesibilitas baik di Light mode maupun Dark mode.

### Don't

* Jangan mematok warna langsung secara *hardcoded* (seperti `bg-[#FF7A00]` atau `text-black`) pada komponen UI utama.
* Jangan menggunakan bayangan hitam pekat di Dark mode; gunakan *subtle border highlight* (`border-line`) untuk memisahkan elevasi kartu/panel.
