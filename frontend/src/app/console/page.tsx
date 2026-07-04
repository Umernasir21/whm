"use client";
/**
 * Enterprise Console — a live, API-driven multi-module shell.
 *
 * Unlike the mock prototype at `/`, every panel here fetches from the real
 * Laravel API (`endpoints.v1.*`). It renders one screen per master module from
 * the NAV_MODULES manifest, with a generic data table, loading skeletons, empty
 * states, and error surfacing. This is the reference pattern the remaining
 * detail screens (create/edit drawers) extend.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings,
  Search, AlertTriangle, Loader2, LogOut, ScrollText, ArrowUpRight,
} from "lucide-react";
import { endpoints, NAV_MODULES } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ICONS: Record<string, any> = {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings,
};

// The API already returns money as dollars (via the Money cast), so format
// as-is — do NOT divide by 100.
const money = (n: number) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

// Modules that have a richer dedicated page — clicking them navigates there
// instead of rendering an in-console table.
const ROUTES: Record<string, string> = {
  "sales-orders": "/sales-orders",
  "purchase-orders": "/purchase-orders",
};

/** How each module loads + which columns to show. */
type Column = { key: string; label: string; render?: (row: any) => React.ReactNode };
type ModuleView = { load: () => Promise<any>; rows: (r: any) => any[]; columns: Column[] };

const VIEWS: Record<string, ModuleView> = {
  dashboard: {
    load: () => endpoints.v1.dashboard(),
    rows: (r: any) => r?.recent_orders ?? [],
    columns: [
      { key: "so_number", label: "Order #" },
      { key: "customer", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "total", label: "Total", render: (o) => money(o.total) },
    ],
  },
  products: {
    load: () => endpoints.v1.products({ per_page: 25 }),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Name" },
      { key: "on_hand", label: "On Hand", render: (p) => p.on_hand ?? 0 },
      { key: "default_price_cents", label: "Price", render: (p) => money(p.default_price_cents) },
    ],
  },
  inventory: {
    load: () => endpoints.v1.inventory({ per_page: 25 }),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "product", label: "Product", render: (l) => l.product?.name ?? "—" },
      { key: "warehouse", label: "Warehouse", render: (l) => l.warehouse?.name ?? "—" },
      { key: "quantity_on_hand", label: "On Hand" },
      { key: "quantity_reserved", label: "Reserved" },
      { key: "available", label: "Available", render: (l) => l.quantity_on_hand - l.quantity_reserved },
    ],
  },
  categories: {
    load: () => endpoints.v1.categories(),
    rows: (r: any) => (Array.isArray(r) ? r : []),
    columns: [
      { key: "name", label: "Name" },
      { key: "parent", label: "Parent", render: (c) => c.parent?.name ?? "—" },
      { key: "products_count", label: "Products" },
    ],
  },
  vendors: {
    load: () => endpoints.v1.vendors({ per_page: 25 }),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "name", label: "Vendor" },
      { key: "email", label: "Email" },
      { key: "purchase_orders_count", label: "POs" },
      { key: "total_spend", label: "Spend", render: (v) => money(v.total_spend ?? 0) },
    ],
  },
  warehouses: {
    load: () => endpoints.v1.warehouses(),
    rows: (r: any) => (Array.isArray(r) ? r : []),
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "locations_count", label: "Locations" },
      { key: "inventory_levels_count", label: "Stocked SKUs" },
    ],
  },
  returns: {
    load: () => endpoints.v1.returns({ per_page: 25 }),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "rma_number", label: "RMA #" },
      { key: "status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "resolution", label: "Resolution" },
    ],
  },
  users: {
    load: () => endpoints.v1.users(),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role", render: (u) => u.role?.label ?? "—" },
      { key: "is_active", label: "Active", render: (u) => (u.is_active ? "Yes" : "No") },
    ],
  },
  notifications: {
    load: () => endpoints.v1.notifications(),
    rows: (r: any) => r?.items ?? [],
    columns: [
      { key: "title", label: "Title" },
      { key: "level", label: "Level" },
      { key: "created_at", label: "When", render: (n) => new Date(n.created_at).toLocaleString() },
    ],
  },
  customers: {
    load: () => endpoints.customers(""),
    rows: (r: any) => r?.data ?? [],
    columns: [
      { key: "name", label: "Name", render: (c) => `${c.first_name} ${c.last_name ?? ""}`.trim() },
      { key: "email", label: "Email" },
      { key: "company_name", label: "Company", render: (c) => c.company_name || "—" },
      { key: "city", label: "City", render: (c) => c.shipping?.city ?? "—" },
    ],
  },
  reports: {
    // Inventory valuation lines — a real, useful report out of the box.
    load: () => endpoints.v1.reports.inventoryValuation(),
    rows: (r: any) => r?.lines ?? [],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "quantity", label: "Qty" },
      { key: "value", label: "Stock Value", render: (l) => money(l.value) },
    ],
  },
  settings: {
    load: () => endpoints.v1.settings(),
    // Settings come grouped; flatten to a flat key/value list.
    rows: (r: any) => (r && typeof r === "object" ? Object.values(r).flat() : []),
    columns: [
      { key: "key", label: "Setting" },
      { key: "value", label: "Value", render: (s) => String(s.value ?? "—") },
      { key: "group", label: "Group" },
    ],
  },
};

export default function ConsolePage() {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [active, setActive] = useState<string>("dashboard");
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: any }>({ loading: true });

  const view = VIEWS[active];

  function selectModule(key: string) {
    if (ROUTES[key]) {
      router.push(ROUTES[key]); // dedicated full-featured page
    } else {
      setActive(key);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    if (!view) {
      setState({ loading: false, data: null });
      return;
    }
    view
      .load()
      .then((d) => alive && setState({ loading: false, data: d }))
      .catch((e) => alive && setState({ loading: false, error: e.message }));
    return () => {
      alive = false;
    };
  }, [active]);

  const rows = useMemo(() => (view && state.data ? view.rows(state.data) : []), [view, state.data]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 grid place-items-center text-white font-bold">W</div>
          <div>
            <div className="text-sm font-semibold">WMS Console</div>
            <div className="text-[11px] text-slate-400">Enterprise Edition</div>
          </div>
        </div>
        <nav className="p-2">
          {NAV_MODULES.map((m) => {
            const Icon = ICONS[m.icon] ?? Package;
            const on = active === m.key;
            const isLink = !!ROUTES[m.key];
            return (
              <button
                key={m.key}
                onClick={() => selectModule(m.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm mb-0.5 transition ${
                  on ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={17} />
                <span className="flex-1 text-left">{m.label}</span>
                {isLink && <ArrowUpRight size={13} className="text-slate-300" />}
              </button>
            );
          })}
          {/* Admin-only: audit trail */}
          {isAdmin && (
            <button
              onClick={() => router.push("/activity-logs")}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm mb-0.5 text-slate-600 transition hover:bg-slate-50"
            >
              <ScrollText size={17} />
              <span className="flex-1 text-left">Activity Logs</span>
              <ArrowUpRight size={13} className="text-slate-300" />
            </button>
          )}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold capitalize">
            {NAV_MODULES.find((m) => m.key === active)?.label ?? active}
          </h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Global search…"
                className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="text-right leading-tight">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-[11px] capitalize text-slate-400">{user.role?.replace(/_/g, " ")}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="p-6">
          {state.loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="animate-spin" size={18} /> Loading {active}…
            </div>
          )}

          {state.error && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <AlertTriangle size={18} />
              <div>
                <div className="font-medium">Could not load {active}.</div>
                <div className="text-sm opacity-80">{state.error} — is the API running at NEXT_PUBLIC_API_URL?</div>
              </div>
            </div>
          )}

          {!state.loading && !state.error && !view && (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-400">
              The <b className="text-slate-600">{active}</b> module screen is scaffolded — data layer &amp; API are ready.
            </div>
          )}

          {!state.loading && !state.error && view && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {view.columns.map((c) => (
                      <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={view.columns.length} className="px-4 py-10 text-center text-slate-400">
                        No records yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {view.columns.map((c) => (
                          <td key={c.key} className="px-4 py-3">
                            {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
