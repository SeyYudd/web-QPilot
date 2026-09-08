# JSON Prompt — Fitur Import Test Case

Dokumen ini adalah **JSON prompt** untuk menghasilkan/meregenerasi fitur **Import Test Case** pada Web Generator dashboard (`dashboard.html` → tab Import, komponen `src/components/dashboard/ImportTestCaseView.tsx`). Fokus: **UI, flow, jenis file & isinya, dan popup**.

```json
{
  "meta": {
    "nama_fitur": "Import Test Case ke Jira Xray",
    "target_komponen": "src/components/dashboard/ImportTestCaseView.tsx",
    "host": "dashboard.html (React + Vite + Tailwind, full tab)",
    "routing": { "tab_key": "import", "label": "Import Test Case", "hash": "#import-test-case" },
    "styling": "Tailwind + UI primitives: Card, CardHeader, CardContent, Button, Badge, Dialog, Toast",
    "auth": "Private — melewati session-check, request Jira via proxy_fetch ke background.js",
    "bahasa_ui": "Indonesia dengan label teknis Inggris (mis. CREATE NEW, REUSE, Retry Failed Only)"
  },

  "ui_layout": {
    "kartu_utama": {
      "judul": "Import Test Case ke Jira Xray",
      "subjudul": "Upload spreadsheet, atau tambah Scenario manual, lalu submit.",
      "toolbar_atas": [
        { "tombol": "Download Template", "aksi": "generate + download XLSX template via SheetJS" },
        { "tombol": "Upload XLSX", "aksi": "buka file picker (.xlsx/.xls), parse, isi tabel preview, auto-scroll ke #import-preview-table" },
        { "tombol": "+ Add Scenario", "aksi": "buka Dialog Add Scenario (form manual)" },
        { "tombol": "Submit (N selected)", "state": "disabled bila busy/running atau selected = 0", "aksi": "buka Dialog Konfirmasi" }
      ]
    },
    "tabel_preview": {
      "id": "import-preview-table",
      "kolom": ["No", "Status (badge: Processing / Uploaded / Failed, kosong sebelum submit)", "Reuse (Ya/Tidak)", "Jira Exist", "Project", "Test ID", "Summary", "Assignee", "Test Repository Path", "Test Execution", "Issue Links", "Labels", "Link Jira (Loading... → hyperlink issue key → '- ⚠' bila gagal)", "Error (pesan validasi)", "Aksi (Edit · Detail · Remove)"],
      "interaksi": [
        "Checkbox select per row (header: select all)",
        "Edit → buka Dialog Edit Row",
        "Detail → expandable row inline menampilkan payload & response (sukses) atau error log (failed), plus duration",
        "Remove → hapus row lalu auto re-number No menjadi 1..n tanpa reload"
      ],
      "update_realtime": "Tiap row di-update in-place asynchronously saat diproses sequential — badge Status & Link Jira berubah per baris tanpa menunggu batch selesai"
    },
    "tombol_kondisional": {
      "retry_failed_only": "Muncul hanya setelah batch selesai DAN ada row berstatus failed; memproses ulang hanya row failed yang masih terselect"
    }
  },

  "file_input": {
    "jenis_yang_diterima": [".xlsx", ".xls"],
    "parser": "SheetJS (XLSX) — dimuat dari src/assets/file/xlsx.full.min.js di dashboard.html",
    "aturan_pembacaan": {
      "header_rows": 2,
      "keterangan": "Baris 1 = judul kolom gabungan, Baris 2 = sub-header (khusus kolom Reuse memecah jadi 'Reuse?' dan 'Jira Exist')",
      "grup_dinamis": "Kolom 'Test Details: Manual Test Steps' berisi grup berulang Action / Data / Expected Result — jumlah grup dinamis, parse sampai kolom kosong"
    },
    "template_download": {
      "nama_file": "Import-TestCase-Template.xlsx",
      "sheet_name": "Test Cases",
      "baris_1": ["No", "Reuse Jira or Not?\n*fill this 2 field if want to reuse", "", "Project", "Test ID", "Summary", "Description", "Assignee", "Test Repository Path", "Expected Result", "Test Execution", "Issue Links", "Labels", "Test Details: Manual Test Steps", "", "", "", "", ""],
      "baris_2": ["", "Reuse?", "Jira Exist", "", "", "", "", "", "", "", "", "", "", "Action", "", "Data", "", "Expected Result", ""],
      "formatting": ["Header bold + warna latar", "Wrap text semua sel", "Lebar kolom menyesuaikan isi"],
      "error_handling": "Jika window.XLSX undefined → tampilkan pesan 'SheetJS belum tersedia.' (bukan crash)"
    },
    "validasi_baris": {
      "no": "Harus integer urut mulai dari 1",
      "wajib": ["Project", "Summary", "Test Repository Path"],
      "reuse": "Jika Reuse? = true → 'Jira Exist' wajib diisi",
      "pesan_error": "Ditampilkan inline pada kolom Error row terkait; row ber-error tidak ikut diproses dan tidak bisa diseleksi"
    }
  },

  "popup_dialog": [
    {
      "nama": "Dialog Add Scenario",
      "trigger": "Tombol '+ Add Scenario'",
      "isi": "Form identik dengan Edit Row, nilai awal dari emptyRow(no berikutnya)",
      "aksi_save": "Tambah row ke tabel, No = jumlah row + 1, tutup dialog"
    },
    {
      "nama": "Dialog Edit Row",
      "trigger": "Tombol 'Edit' pada row",
      "isi": {
        "fields_text": ["project", "testId", "summary", "description", "assignee", "repository", "expectedResult", "testExecution", "issueLinks", "labels", "jiraExist"],
        "layout": "Grid 2 kolom; summary, description, repository, expectedResult span 2 kolom (wide)",
        "checkbox_reuse": "Sembunyikan section Manual Test Steps saat Reuse dicentang",
        "manual_test_steps": {
          "tampil": "Hanya bila reuse = false",
          "tiap_step": "3 textarea: action, data, expectedResult (label Step N)",
          "tombol": "+ Add Step (tambah step) · Remove per step (disabled bila hanya 1 step)"
        }
      },
      "aksi_save": "Patch row via onSave; validasi dijalankan ulang, error inline di tabel"
    },
    {
      "nama": "Dialog Konfirmasi Submit",
      "trigger": "Tombol 'Submit (N selected)'",
      "isi": "Ringkasan: N row akan diproses (list mode CREATE NEW vs REUSE)",
      "aksi": "Konfirmasi → jalankan batch; batal → tutup dialog tanpa efek"
    },
    {
      "nama": "Toast",
      "trigger": "Feedback hasil batch",
      "isi": "Contoh: 'Import test case selesai: X Success, Y Failed.'",
      "tone": "success bila failed=0, error bila ada failed, info untuk proses",
      "durasi": "Auto-dismiss ±6 detik"
    },
    {
      "nama": "Overlay",
      "trigger": "Saat busy/running",
      "isi": "LoadingOverlay penuh, mencegah interaksi ganda"
    }
  ],

  "flow": {
    "1_download_template": "Klik Download Template → SheetJS generate XLSX → triggerDownload",
    "2_input_data": "Upload XLSX (parse 2 header rows + grup steps dinamis) ATAU Add Scenario manual",
    "3_validasi_preview": "Setiap row divalidasi (valid()), error inline; row invalid tak bisa diseleksi/diproses",
    "4_koreksi": "Edit per row via Dialog / Remove row (re-number otomatis)",
    "5_submit": "Pilih rows → Submit → Dialog Konfirmasi → proses sequential satu-per-satu",
    "6_proses_per_row": {
      "mode_create_new": {
        "steps": [
          "POST /rest/api/2/issue dengan Test Type Manual (customfield_11400: { id: '10801' })",
          "Manual steps dikirim sebagai customfield_11404 format Xray Server: { steps: [{ index, fields: { Action, Data, 'Expected Result' } }] }",
          "Degrade bertingkat bila Jira menolak: (a) tanpa customfield_11404, (b) hanya field dasar → steps diisi ulang via PUT /rest/api/2/issue/{key}"
        ]
      },
      "mode_reuse": "Pakai issue key dari kolom Jira Exist (tidak create baru)",
      "post_action": "Link ke Test Repository (folder path → resolve folder id), add ke Test Execution (addTestToExecution), issue links (linkIssues) — sesuai isi kolom terkait"
    },
    "7_hasil": {
      "sukses": "Status Uploaded, Link Jira hyperlink ke issue, Detail menampilkan payload/response + duration",
      "gagal": "Status Failed, Link Jira '- ⚠', Detail menampilkan error log; tombol Retry Failed Only tersedia",
      "ringkasan": "Toast jumlah Success/Failed"
    }
  },

  "state": {
    "rows": "Row[] — no, reuse, jiraExist, project, testId, summary, description, assignee, repository, expectedResult, testExecution, issueLinks, labels, steps[], selected, error, result?, statusCode?, jiraKey?, detail?, payload?, duration?",
    "edit": "index row yang sedang diedit (null = tutup)",
    "addOpen": "boolean Dialog Add Scenario",
    "confirmOpen": "boolean Dialog Konfirmasi Submit",
    "expanded": "no row yang di-expand (Detail)",
    "busy": "boolean loading input/parse",
    "running": "boolean batch sedang berjalan",
    "template": "string pesan error SheetJS | null",
    "toast": "{ message, tone } | null"
  },

  "gotchas": [
    "Semua request Jira wajib lewat proxy_fetch ke background.js, bukan fetch() langsung",
    "Hapus row WAJIB re-number kolom No menjadi 1..n",
    "Setelah upload XLSX sukses, auto-scroll ke #import-preview-table",
    "Dialog konfirmasi ditutup segera setelah submit; update row in-place sequential",
    "Retry Failed Only hanya render bila batch selesai & ada failed",
    "Format customfield_11404 diverifikasi dari issue existing Jira — jangan mengubah struktur fields tanpa verifikasi"
  ]
}
```
