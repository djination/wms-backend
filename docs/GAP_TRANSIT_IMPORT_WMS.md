# GAP Matrix — Warehouse Transit Import (NOA → Transit → Customs Release → DC / Customer)

## Tujuan dokumen

Memetakan **alur bisnis impor via gudang transit** (berdasarkan pengalaman operasional: NOA + dokumen → inbound transit → dwell hingga release bea cukai → distribusi) terhadap **kemampuan WMS saat ini**, agar pekerjaan implementasi **bertahap, additif**, dan **tidak merombak** flow inbound/outbound yang sudah stabil.

## Ringkasan alur target

1. **Pra-kedatangan:** notifikasi / kedatangan (mis. NOA) + dokumen pendukung (Commercial Invoice, Packing List, BL/AWB, dll.).
2. **Fisik di gudang transit:** receiving / putaway ke bin di gudang transit; **mulai terhitung dwell** (lama barang di transit) sampai status **cleared / released** dari sisi bea cukai (atau setara).
3. **Pasca-release:** internal transfer ke gudang penyimpanan **atau** outbound langsung (pickup customer / kirim ke customer).

## Prinsip implementasi (guardrail)

- **Default perilaku tidak berubah:** gudang & ASN existing tanpa flag transit/customs harus identik dengan hari ini.
- **Dimensi orthogonal:** jangan mengganti makna `WarehouseType` (`SHARED` / `DEDICATED`); tambah **profil peran gudang** dan/atau **status legal stok** secara opsional.
- **Reuse proses:** ASN → receiving → receipt → inventory; pasca-release gunakan **Internal Transfer** dan/atau **Sales Order + outbound** yang sudah ada.
- **Validasi di service layer** pada titik outbound / transfer keluar transit, bukan menyentuh seluruh modul sekaligus.

---

## Fase 0 — Keputusan terkunci (disetujui 2026-05-04)

| Topik | Keputusan | Catatan |
| --- | --- | --- |
| **Sumber kebenaran status hold / clearance (MVP)** | Pada **`InboundReceipt`** (bukan `InventoryBalance` dulu) | Satu baris penerimaan = satu jejak “mulai dwell” / “cleared”; implementasi Fase 2 lebih sederhana; saldo tetap mengikuti receipt yang sudah ada. |
| **Partial release per baris** | **Tidak** wajib di v1 | Satu receipt dianggap satu kesatuan untuk status customs; partial bisa ditunda ke iterasi berikutnya (pecah receipt atau status per saldo). |
| **Penanda gudang transit (Fase 1)** | Field boolean **`isTransitImportHub`** di `Warehouse`, default **`false`** | Ortogonal terhadap `WarehouseType`; gudang existing tanpa sentuhan tetap `false`. |

---

## Current capability vs gap

| Kebutuhan bisnis | Kemampuan saat ini | Gap | Aksi yang disarankan |
| --- | --- | --- | --- |
| Multi-customer, multi-warehouse, ASN + receiving + bin stock | Ada (`InboundAsn`, `InboundReceipt`, `InventoryBalance`, master warehouse) | — | Tetap jadi backbone |
| Membedakan gudang “transit impor” vs gudang DC biasa | `Warehouse` + **`isTransitImportHub`** (boolean, default false) + API/UI master data | — (Fase 1) | Lanjut Fase 2: default hold di receipt bila receive ke hub ini |
| NOA / nomor referensi pra-kedatangan terpisah dari ASN | `InboundAsn` punya `referenceNo`, `expectedAt` | Tidak ada tipe referensi, tidak ada entitas “shipment/consignment” multi-dokumen | Fase 1: perkaya ASN dengan field opsional (`preArrivalRef`, `vesselFlight`, `eta`, `docRefs` JSON). Fase 2: entitas `ImportShipment` / header konsolidasi jika satu NOA → banyak ASN |
| Lampiran dokumen (CI, PL, BL, …) | Tidak terlihat di schema inbound | Tidak ada **document attachment** terikat ASN/shipment | Model `InboundDocument` atau generic `BusinessDocument` (entityType, entityId, docType, storageUrl/meta, uploadedAt) |
| Stok di transit “belum boleh outbound” sampai release | Receipt **HELD** + saldo `qtyOnHand` | — (Fase 3 inti) | Alokasi outbound & task (bin) & transfer/transform complete memakai **qty tersedia** = on-hand − Σ receipt HELD per bin/produk di gudang transit |
| Mencatat waktu mulai dwell & waktu release | `receivedAt` di receipt; tidak ada `clearedAt` / hold start eksplisit | Tidak ada timestamp **release** & reporting dwell terstandar | Field `customsHoldStartedAt`, `customsReleasedAt` (receipt atau balance line); KPI/query dwell dari situ |
| Melepas (release) dari UI/API | Tidak ada | Tidak ada endpoint & audit trail release | API “mark cleared” + optional `releaseRef` (nomor pelepasan) + event log |
| Pasca-release: pindah ke gudang simpan | `InternalTransfer` ada | Transfer dari transit **harus** dicek: hanya jika cleared (jika aturan dipakai) | Guard di `InternalTransfer` complete (source warehouse transit → wajib cleared) |
| Pasca-release: langsung ke customer | `SalesOrder` + outbound ada | SO dari gudang transit **harus** dicek clearance | Guard di allocate/pick/release wave (sumber stok dari bin transit) |
| Billing dwell / storage transit | `BillingTransaction` ada pola reference | Belum ada **activity code** / komponen khusus dwell transit | Definisikan `activityCode` + trigger (harian? per receipt?) setelah model dwell jelas |
| UI operasional: tandai gudang transit, upload dok, status hold, release | Panel inbound existing | Tidak ada UX untuk alur impor | Form master warehouse; inbound ASN detail (docs + hold); dashboard dwell opsional |
| Integrasi bea cukai / SPPB otomatis | Tidak ada | Gap eksternal penuh | Fase akhir: webhook/manual import status; jangan blokir fase 1–2 dengan integrasi |

---

## Backlog kerja (urutan disarankan)

### Fase 0 — Dokumentasi & kontrak (no code / ringan)

- [x] Finalisasi enum status hold (minimal: `NONE`, `HELD`, `CLEARED`) dan di mana disimpan (receipt vs balance) — lihat tabel Fase 0 di atas.
- [x] Kebijakan: partial release per line vs per ASN — **tidak** di v1 (lihat tabel Fase 0).

### Fase 1 — Master data & metadata (low risk)

- [x] Migrasi: `warehouses.is_transit_import_hub` (boolean, default false).
- [x] API + DTO master data: create/update warehouse dengan `isTransitImportHub`.
- [x] Frontend: tampilkan/edit di form & tabel master gudang.

### Fase 2 — Inbound + dokumen + hold

- [ ] Migrasi: dokumen terikat ASN — **ditunda (2b)**; tidak memblokir dwell/release.
- [x] Migrasi: status clearance + timestamp di **`InboundReceipt`** (`InboundReceiptCustomsClearanceStatus`, hold/released/ref).
- [x] Saat receiving ke gudang `isTransitImportHub`: set **`HELD`** + `customsHoldStartedAt`; selain itu **`NONE`**.
- [ ] API upload/registrasi dokumen + list by ASN — **ditunda (2b)**.
- [x] API **customs release**: `POST /inbound/receipts/:id/customs-release` (`HELD` → `CLEARED`, `releaseRef` opsional). UI: tabel receipts di modal ASN + petunjuk di form Receiving.

### Fase 3 — Guards outbound & transfer

- [x] `InternalTransfer` complete: cek **qty tersedia** = `qtyOnHand − sum(receipt HELD)` di bin sumber gudang transit; gagal jika kurang dari `qtyBase` line.
- [x] `MaterialTransformation` complete: aturan yang sama untuk setiap input bin/produk.
- [x] Outbound **alokasi** (`allocateSalesOrderInternal`): alokasi per bin memakai **effective on-hand** setelah potong receipt **HELD** (gudang transit); metadata event `ORDER_ALLOCATED` / `ORDER_REALLOCATED`: `inboundCustomsHoldApplied`, `inboundCustomsHoldBinIds`.
- [x] Outbound **`createTask`** dengan `sourceBinId`: validasi qty task terhadap stok tersedia setelah HELD (satu bin).
- [ ] Event khusus `OUTBOUND_BLOCKED_HOLD` per percobaan gagal — **tidak** ditambah (cukup pesan `BadRequest` + metadata alokasi); `CUSTOMS_RELEASED` tetap jejak via update receipt (bisa ditingkatkan ke event log terpisah nanti).

### Fase 4 — Observability & billing

- [x] KPI `GET /kpi/summary` — blok **`transitImportCustoms`**: receipt HELD open (count + qty basis + rata jam dwell open), cleared di periode (`customsReleasedAt` ∈ filter) + rata dwell hold→release; basis agregat `all` / `sample_first_*` bila data besar.
- [x] Billing draft saat **customs release**: `billing_transactions` komponen **STORAGE**, `activityCode` **`TRANSIT_CUSTOMS_DWELL_DAY`**, UOM **DAY**, qty = fraksi hari (hold→release), amount = qty × rate aktif kontrak customer bila ada; `referenceType` **`INBOUND_RECEIPT`**.

### Fase 5 — Integrasi eksternal (opsional)

- [ ] Impor status dari sistem bea cukai / forwarder; mapping ke `CLEARED` + referensi resmi.

---

## Definisi “selesai” MVP (transit import)

- Gudang bisa ditandai sebagai **transit import hub** tanpa mengubah perilaku gudang lain.
- ASN + receiving ke gudang itu menghasilkan receipt status customs **HELD** sampai aksi release (pembatasan konsumsi stok outbound/transfer di **Fase 3**).
- Setelah release, **internal transfer** dan **outbound** kembali berperilaku seperti sistem sekarang, dengan stok yang sudah cleared.
- Jejak audit: siapa me-release, kapan, nomor referensi pelepasan.

---

## Referensi file / area codebase (titik sentuh perkiraan)

- Schema: `backend/prisma/schema.prisma` — `Warehouse`, `InboundAsn`, `InboundReceipt`, `InventoryBalance`, `InternalTransfer`, `SalesOrder` / outbound services.
- Backend inbound: `backend/src/modules/inbound/`
- Backend master data: `backend/src/modules/master-data/`
- Backend outbound & transfer: `backend/src/modules/outbound/`, modul internal transfer (sesuai struktur repo).
- Frontend: `frontend-web/src/components/inbound/`, `frontend-web/src/components/master-data/`

---

## Status dokumen

| Versi | Tanggal | Catatan |
| --- | --- | --- |
| 0.1 | 2026-05-04 | Draft awal GAP dari diskusi alur NOA → transit → release → DC/customer |
| 0.2 | 2026-05-04 | Fase 0 terkunci; Fase 1: `isTransitImportHub` di warehouse + UI master data |
| 0.3 | 2026-05-04 | Fase 2 (inti): enum + kolom customs di `InboundReceipt`, receive → HELD di hub transit, API + UI release; dokumen ASN ditunda 2b |
| 0.4 | 2026-05-04 | Fase 3: util `qtyOnHand` efektif (− inbound HELD), guard transfer/transform/allocate + createTask(sourceBin) + metadata alokasi |
| 0.5 | 2026-05-04 | Fase 4: KPI dwell transit di `/kpi/summary` + dashboard; draft billing dwell pada release (STORAGE / TRANSIT_CUSTOMS_DWELL_DAY) |
