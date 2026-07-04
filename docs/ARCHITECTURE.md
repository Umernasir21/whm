# WMS — System Architecture

**Scope (Phase 1, documented core):** Sales Orders, Purchase Orders, Customers, Invoicing, Shipment tracking, Profit reporting, Auth + RBAC.

Derived from the uploaded requirements document and its 11 screenshots. Where the screenshots showed a flat spreadsheet-style tool, this design keeps the **workflow** (customer capture → SO line items → auto SO number → search → edit shipment → invoice; PO grid; total profit) but re-architects it as a normalized relational system with a REST API and a modern SPA.

---

## 1. High-level topology

```
                          ┌──────────────────────────┐
                          │        Cloudflare        │  SSL / CDN / WAF
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │      Nginx (reverse       │
                          │      proxy + static)      │
                          └───────┬──────────┬────────┘
                                  │          │
                  /api/*  ────────┘          └──────── /  (everything else)
                    │                                    │
        ┌───────────▼───────────┐            ┌───────────▼───────────┐
        │  Laravel 12 (PHP-FPM) │            │   Next.js 15 (Node)   │
        │  REST API + Sanctum   │            │   App Router / React  │
        └───┬─────────┬─────────┘            └───────────────────────┘
            │         │
   ┌────────▼──┐  ┌───▼─────────┐   ┌──────────────┐
   │  MySQL 8  │  │   Redis     │   │  Queue Worker │  (Supervisor)
   │  (data)   │  │ cache+queue │   │  (php artisan │
   └───────────┘  └─────────────┘   │   queue:work) │
                                     └──────────────┘
```

## 2. Layers (backend)

Request flow: **Route → Controller → FormRequest (validation) → Service → Repository/Eloquent → DB**, response shaped by an **API Resource**.

- **Controllers** are thin. They validate (via FormRequest), delegate to a Service, and return a Resource. No business logic.
- **Services** hold business logic and own DB transactions (e.g. creating an SO with its line items and generating the SO number atomically).
- **Models** define relationships, casts, and scopes. Money is stored in integer **minor units (cents)** to avoid float error.
- **Resources** shape JSON output (never leak internal columns).
- **Policies + Permissions** enforce RBAC on every write.
- **Events/Jobs** handle side effects (invoice PDF render, email) off the request cycle via the queue.

## 3. Core domain model

```
User ─┬─< belongs to >─ Role ─< has many >─ Permission
      │
Customer ─< has many >─ SalesOrder ─< has many >─ SalesOrderItem >─ Product
                            │
                            ├─ has one  ─ Shipment
                            └─ has one  ─ Invoice

Vendor ─< has many >─ PurchaseOrder ─< has many >─ PurchaseOrderItem >─ Product

Product ─< has many >─ (SO items, PO items)   [inventory-ready but light in P1]
```

**Profit** is derived: `SO revenue (sum of line totals + shipping + tax collected) − PO cost attributable`. Phase 1 computes total profit as `Σ sales_order.grand_total − Σ purchase_order.grand_total` and per-order margin where a PO is linked, matching the document's "Total Profit Display".

## 4. Money & numbering

- **Money:** all monetary columns are `BIGINT` cents. A `Money` cast converts to/from decimal at the edges.
- **SO numbering:** `SO-00001` zero-padded, generated atomically inside the create transaction using a dedicated `sequences` table with `SELECT ... FOR UPDATE` (no race conditions). PO uses `PO-00001`, Invoice `INV-00001`.

## 5. Security

Sanctum token auth (SPA cookie mode); RBAC via roles/permissions; policies on writes; server-side validation via FormRequests; rate limiting on auth + API; soft deletes on core entities; full audit log (`activity_log`) capturing who/what/when for every create/update/delete.

## 6. Deployment

Docker Compose: `nginx`, `app` (PHP-FPM 8.4), `queue` (worker), `mysql`, `redis`, `frontend` (Next.js). Supervisor keeps the worker alive. Env-driven config. See `docker/` and `docs/DEPLOYMENT.md`.
