# Warehouse Management System (WMS)

Production-oriented WMS. Started from the uploaded requirements document (Sales/Purchase orders, customers, invoicing, shipment tracking, profit) and **expanded into a full enterprise WMS**: multi-warehouse inventory with a movement ledger and valuation, returns/RMA, PO receiving, 7-role RBAC, notifications, global search, and an expanded reporting suite across a versioned `/api/v1`.

> **📊 See [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md)** for the full before/after gap analysis, the itemised feature comparison, verification status, and the honest remaining backlog.

## Stack

| Layer      | Technology                                            |
|------------|-------------------------------------------------------|
| Frontend   | Next.js 15 (App Router), React 19, TypeScript, Tailwind, Recharts, Lucide |
| Backend    | Laravel 12, PHP 8.4, Sanctum auth, service layer, DomPDF |
| Database   | MySQL 8.4, normalized schema, FKs, indexes, transactions |
| Infra      | Docker Compose — Nginx, PHP-FPM, MySQL, Redis, queue worker |

## What's implemented

**Backend (`/backend`)**
- Migrations for the full schema (RBAC, parties, products, sales/purchase orders, items, shipments, invoices, audit log, atomic sequences).
- Eloquent models with relationships, soft deletes, and an integer-cents `Money` cast.
- Service layer: `SalesOrderService`, `PurchaseOrderService`, `InvoiceService`, `ProfitService`, plus race-free `SequenceService` (SO-00001 / PO-00001 / INV-00001) and `ActivityLogger`.
- REST API: auth, dashboard, customers, sales orders (with shipment editing), purchase orders, invoice generation + PDF download, profit report.
- FormRequest validation on every write; permission checks via roles/permissions.
- Branded invoice PDF template (modernized from the document's invoice mockup).
- Seeder with roles (admin/manager/clerk), users, and realistic sample data.

**Frontend (`/frontend`)**
- Typed API client with Sanctum token handling and a React auth context (`can()` permission gate).
- Next.js app scaffolding (layout, Tailwind, standalone build for Docker).
- `wms-prototype.jsx` — the complete interactive UI (dashboard, sales/purchase/customer/invoice screens, dark+light mode, drawers, modals, toasts). Drops into `src/app/page.tsx` with API calls swapping in for the mock data layer.

**Infra (`/docker`, `docker-compose.yml`)**
- One-command stack. See `docs/DEPLOYMENT.md`.

## Documentation

- `docs/ARCHITECTURE.md` — system design, layers, money/numbering, security.
- `docs/schema.sql` — reference MySQL DDL.
- `docs/DEPLOYMENT.md` — run instructions.

## How the screenshots map to features

| Screenshot | Feature built |
|---|---|
| Fig 1–2 Sales Order grid | Sales order create + line items + totals + payment fields |
| Fig 3 Customer form | Customer create with shipping details (validated modal) |
| Fig 4–5 Customer search/submit | Customer search endpoint + attach-to-order flow |
| Fig 6 SO number | Atomic `SequenceService` → `SO-00001` format |
| Fig 7 SO search grid | Sales order index with status/type/date/keyword filters |
| Fig 8 Edit SO (carrier/status) | Shipment drawer: carrier, tracking, status + auto timestamps |
| Fig 9 Invoice + ship-from | DomPDF invoice with default Richmond, TX ship-from |
| Fig 10 Purchase Order grid | Purchase order create with condition, qty, buying tax |
| Fig 11 Total profit | `ProfitService` → dashboard profit pulse + profit report |

## Roadmap beyond Phase 1

Inventory/bins/racks, stock transfers, cycle counts, barcode/serial/lot tracking, returns (RMA), vendor management UI, and analytics — the schema and service structure are designed to extend into these without rework.
