# QPilot Engineering Roast

## Current Assessment

QPilot sekarang lebih kecil dan lebih terarah daripada audit lama. Core aktifnya
adalah Web Generator React (Create SIT, Check & Sync, Upload Capture, Import Test
Case), Playwright Generator, quick tools, shortcut
Confluence, dan Settings. Audit ini menilai kondisi tersebut, bukan fitur yang
sudah dihapus.

## Kekuatan

- Web Generator memiliki empat flow yang jelas: Create SIT, Check & Sync TE,
  Upload Capture, dan Import Test Case.
- Request Jira/Confluence halaman fitur melewati `proxy_fetch`; service worker
  memiliki auth policy, timeout, response metadata, dan cookie fallback.
- Payload upload besar menggunakan IndexedDB, sedangkan local storage menyimpan
  metadata queue.
- Playwright picker dapat membuffer record ke service worker saat tab generator
  sudah tertutup.
- Smoke check dan build tersedia sebagai baseline verifikasi.

## Masalah Utama Saat Ini

1. `background.js` masih monolitik dan mencampur proxy, queue, context menu,
   network, upload, dan legacy capture code.
2. Message protocol belum memiliki runtime schema atau penolakan action yang
   konsisten. Listener network juga terpisah dari listener utama.
3. Manifest memakai host permission seluruh HTTP/HTTPS. Command keyboard sudah
   dipetakan penuh ke handler (`open-web-generator`, `fill-dummy-data`,
   `expand-all-sections`), tetapi host permission luas belum disempitkan
   per origin.
4. Credential masih plaintext di `chrome.storage.local`. Ini harus disebut
   sebagai risk, bukan secure vault.
5. Context-menu capture masih menyisakan action legacy yang tidak memiliki
   penerima statis yang dapat diandalkan.
6. Queue sudah memakai operation ID dan retry, tetapi belum menjadi state machine
   yang diaudit dan belum memiliki orphan-blob cleanup berbasis TTL.
7. Import Test Case sudah memiliki preview dan retry per baris, tetapi mapping
   repository bergantung pada response hierarchy Xray dan belum punya contract test.
8. Test automation belum tersedia; smoke check tidak menguji API atau browser.

## Prioritas Perbaikan

1. Selesai nasib context-menu capture legacy; command keyboard sudah sinkron
   dengan manifest (semua ter-handle).
2. Tetapkan kontrak action/response, error code, dan idempotency.
3. Tambahkan test harness untuk proxy, queue, storage, dan parser.
4. Modularisasi background service worker.
5. Tambahkan preview/diff, audit history, dan retry failed only.
6. Baru kemudian pertimbangkan defect flow, Drive, atau modul legacy lain.

## Kesimpulan

Produk aktif sudah memiliki core workflow yang bernilai, tetapi security
permission, legacy capture, dan reliability update masih membatasi kesiapan
penggunaan luas. Prioritas yang benar adalah memperkuat
Jira -> SIT -> evidence -> Confluence, bukan menambah menu baru.
