# WMS — Gap Analysis & Enterprise Expansion Report

**Prepared as:** Software Architect / Backend / Database / Security / QA review
**Baseline:** The uploaded *WMS Development Requirements* PDF (11 screenshots) + the existing Phase‑1 Laravel/Next scaffold.
**Date:** 2026‑07‑04

---

## 1. Executive summary

The uploaded document specifies a **spreadsheet‑style order tool**: a Sales Order screen, a Customer capture modal, auto SO numbering, an SO search grid, an invoice PDF, an Edit‑SO shipment field, a Purchase Order grid, and a single "total profit" figure. Nine features, all UI‑centric.

The pre‑existing scaffold implemented roughly **40 % of that document** as a well‑structured Laravel API + a **mock‑data** Next.js prototype. Two honesty notes on the starting point:

1. The frontend prototype ran entirely on hardcoded seed arrays — **it never called the API**.
2. The backend had **never been installed or migrated** (no `vendor/`, no DB).

This report (a) itemises every gap against a modern WMS, and (b) documents the expansion that was built to close them: a full **inventory & warehouse core**, **returns/RMA**, **PO receiving**, **7‑role RBAC**, **notifications**, **global search**, an expanded **reporting** suite, and a versioned **`/api/v1`** across ~15 modules.

---

## 2. Gap analysis — what the document/scaffold was missing

| Domain | Missing in baseline | Status after expansion |
|---|---|---|
| **Inventory** | No stock at all — no on‑hand/reserved/available, no ledger, no valuation | ✅ `inventory_levels` + append‑only `stock_movements`, WAC valuation, negative‑stock prevention |
| **Warehouses** | Single implicit location | ✅ Multi‑warehouse + hierarchical `stock_locations` (zone→aisle→rack→shelf→bin) |
| **Stock ops** | None | ✅ Receive, issue, **adjust‑to (cycle count)**, **transfer**, reserve/release |
| **Traceability** | None | ✅ Serial numbers, lot/batch + expiry, barcode/QR fields |
| **Products** | SKU + name + price only | ✅ Category, cost, reorder point/qty, UoM, valuation method, tracking flags, weight/dims, images, active flag, low‑stock accessor |
| **Categories** | Absent | ✅ Self‑referencing category tree |
| **Sales order lifecycle** | 5 statuses | ✅ 12 statuses (draft→pending→approved→confirmed→packed→ready_to_ship→partially_shipped→shipped→delivered→cancelled→returned→refunded) |
| **Purchase order lifecycle** | 4 statuses, no receiving | ✅ 8 statuses + approval workflow + **partial/full receiving with discrepancy tracking** posting into inventory |
| **Returns / RMA** | Absent | ✅ Full lifecycle: request→approve→inspect→restock→refund/replace/credit; restock routes back to inventory |
| **Credit notes** | Absent | ✅ Issued on store‑credit returns |
| **Customers** | Flat address columns | ✅ Multiple billing/shipping addresses, tags, polymorphic notes, lifetime‑revenue accessor |
| **Vendors** | Model only, no API/UI | ✅ Full CRUD + spend/PO rollups |
| **Shipping** | USPS/UPS/FedEx enum | ✅ + DHL/Other, tracking URL, weight/dims, cost, multi‑package, proof‑of‑delivery field |
| **RBAC** | 3 roles, ~11 perms | ✅ 7 roles (super_admin/admin/manager/sales/purchasing/accountant/viewer), full module × action permission matrix |
| **Security/audit** | Login throttle + activity log table (partially wired) | ✅ + login history table, password policy (min‑10 mixed+numbers), soft deletes across entities, per‑movement ledger, self‑delete guard |
| **Notifications** | Absent | ✅ In‑app notifications + role broadcast (e.g. low‑stock alerts fired from InventoryService) |
| **Global search** | Absent | ✅ Cross‑entity search (products, customers, SOs, POs, vendors, tracking #s) |
| **Reports** | Profit only | ✅ Sales, purchases, inventory valuation, fast/slow/dead‑stock, top customers, top vendors |
| **Dashboard** | Basic KPIs on mock data | ✅ Live KPIs incl. inventory value, low/out‑of‑stock, open returns, pending shipments, top customers |
| **API design** | Unversioned, partial | ✅ `/api/v1` across 15 modules, pagination, filtering, search; back‑compat aliases retained |
| **Platform** | — | ✅ Settings key/value store, saved filters, polymorphic attachments, order‑event timeline |

---

## 3. What was built (this expansion)

**Database (3 new migrations, ~30 tables)**
- `…_create_inventory_tables` — categories, warehouses, stock_locations, product enrichment (16 columns + FULLTEXT), product_images, inventory_levels, stock_movements, serial_numbers, lot_batches.
- `…_create_operations_tables` — customer_addresses, tags (+pivot), returns, return_items, credit_notes, po_receipts, po_receipt_items, notes (poly), attachments (poly), notifications, login_history, settings, saved_filters, order_events.
- `…_extend_order_lifecycle` — widened SO/PO/carrier enums; added warehouse/address/discount/COGS/profit/approval columns; PO `quantity_received`; shipment enrichment.

**Models (21 new + 4 extended)** — relationships, casts, soft deletes, money‑as‑cents, computed accessors (`quantity_available`, `total_on_hand`, `is_low_stock`, `lifetime_revenue_cents`).

**Services**
- `InventoryService` — the engine: transactional, row‑locked receive/issue/reserve/release/transfer/adjust; weighted‑average costing; negative‑stock guard; low‑stock notifications.
- `ReturnService`, `NotificationService`, `ReportService`, `GlobalSearchService`; `PurchaseOrderService::receive()` posts receipts into inventory.

**API (`/api/v1`)** — Product, Category, Vendor, Warehouse (+locations), Inventory (levels/low‑stock/movements/receive/adjust/transfer), Sales Order, Purchase Order (+approve/receive), Return (+status), Notification, User/Role, Login history, Global search, Settings, expanded Reports & Dashboard.

**Frontend** — API client extended with typed helpers for every module (`endpoints.v1.*`), a `NAV_MODULES` manifest, and a **live, API‑driven Enterprise Console** (`/console`) rendering every module with loading/empty/error states.

**Seeder** — 6 sequences, full permission matrix, 7 roles with realistic grants, 3 users, 2 warehouses + bins, category tree, 4 products with opening inventory (incl. deliberately low/zero stock to exercise alerts).

---

## 4. Verification performed (actually run)

The scaffold turned out to be **not a bootable Laravel app** — `config/` was empty and there were no `artisan` / `public/index.php` / provider entrypoints (which is why it had "never been run"). Those skeleton files were added, then the system was booted and exercised for real:

- ✅ **`composer install`** completed; **all 50+ PHP files pass `php -l`**.
- ✅ **`php artisan route:list` → 87 routes**, every controller across the whole `/api/v1` surface resolves.
- ✅ **`migrate:fresh --seed` runs clean** (all 6 migrations) after making the MySQL‑only DDL **driver‑portable** (guarded FULLTEXT + `MODIFY ENUM` behind a driver check).
- ✅ **Seed verified by query:** 3 users / 7 roles / 37 permissions, 2 warehouses / 3 bins, 4 products with opening inventory, movement ledger populated, **weighted‑average cost = 49.99**, low‑stock flag correctly set, gapless **SO‑00001 / PO‑00001**.
- ✅ **Live HTTP tested** (`artisan serve` + curl): login → token; dashboard KPIs (`inventory_value`, `low_stock: 3`, `out_of_stock: 2`); inventory valuation ($2,178, arithmetic‑verified); global search; **write paths** — product create (auto‑SKU) and a stock adjustment that correctly wrote a ledger entry (`adjustment_in`, `balance_after: 100`); reports (stock‑movement, top‑customers).
- 🐞 **Bugs found and fixed during live testing:** missing `api` rate limiter (added), and three MySQL‑only SQL functions (`DATE_FORMAT`, `CONCAT`, `HAVING`‑without‑`GROUP BY`) rewritten to portable equivalents so the app runs on **both MySQL and SQLite**.

**Net:** the backend is now genuinely bootable and functional end‑to‑end. The SQLite run was a test harness; **MySQL 8 remains the production target** (and the FULLTEXT/ENUM paths still activate there).

---

## 5. How to run

```bash
# Backend
cd wms-system/backend
composer install
cp .env.example .env && php artisan key:generate
# set DB_* to a MySQL 8 database in .env
php artisan migrate --seed
php artisan serve            # http://localhost:8000

# Frontend
cd ../frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev                  # http://localhost:3000  (live console at /console)
```
Login: `admin@wms.test` / `Password123` (super admin).

---

## 6. Honest remaining work (not yet built)

To reach true parity with NetSuite/SAP/Odoo/Fishbowl, these remain — the schema + service layer are designed to absorb them without rework:

- **Frontend depth:** create/edit drawers, invoice/packing‑slip/label PDF UIs, bulk actions, saved‑filter UI, dark mode, command‑palette wiring, per‑module detail pages (only the list/console layer is live).
- **Fulfilment:** pick/pack/wave workflows, barcode scanning UI, label carrier APIs (EasyPost/Shippo), real tracking webhooks.
- **Accounting:** GL postings, tax engine, AR/AP aging beyond credit notes.
- **Automation:** queue jobs for emails/PDFs/notifications (worker is defined but not yet dispatched to), scheduled reorder suggestions.
- **Security hardening:** 2FA enablement flow, field‑level encryption, CSRF‑for‑SPA config, per‑endpoint policy classes (currently permission checks are in‑controller).
- **Testing/CI:** feature + unit test suite, GitHub Actions pipeline.
- **Ops:** run the stack, prove flows, seed larger demo dataset.

This document is the source of truth for scope; §6 is the honest backlog.
