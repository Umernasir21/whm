"use client";
/**
 * Enterprise Console — live, API-driven multi-module shell with a rich dashboard
 * (KPI cards, revenue chart, top customers), light/dark themes, and a generic
 * data table for every master module. All data comes from the Laravel API.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings,
  Search, AlertTriangle, Loader2, LogOut, ScrollText, ArrowUpRight, FileText,
  Sun, Moon, TrendingUp, DollarSign, TriangleAlert, Truck, PackageX,
} from "lucide-react";
import { endpoints, NAV_MODULES } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const ICONS: Record<string, any> = {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings, FileText,
};

// API returns money as dollars — format as-is.
const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => (n ?? 0).toLocaleString("en-US");

const ROUTES: Record<string, string> = {
  "sales-orders": "/sales-orders",
  "purchase-orders": "/purchase-orders",
};

/* ---- generic table views (non-dashboard modules) ------------------------- */
type Column = { key: string; label: string; render?: (row: any) => React.ReactNode };
type ModuleView = { load: () => Promise<any>; rows: (r: any) => any[]; columns: Column[] };

const VIEWS: Record<string, ModuleView> = {
  products: {
    load: () => endpoints.v1.products({ per_page: 25 }),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Name" },
      { key: "on_hand", label: "On Hand", render: (p) => num(p.on_hand ?? 0) },
      { key: "default_price_cents", label: "Price", render: (p) => money(p.default_price_cents) },
    ],
  },
  inventory: {
    load: () => endpoints.v1.inventory({ per_page: 25 }),
    rows: (r) => r?.data ?? [],
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
    rows: (r) => (Array.isArray(r) ? r : []),
    columns: [
      { key: "name", label: "Name" },
      { key: "parent", label: "Parent", render: (c) => c.parent?.name ?? "—" },
      { key: "products_count", label: "Products" },
    ],
  },
  customers: {
    load: () => endpoints.customers(""),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "name", label: "Name", render: (c) => `${c.first_name} ${c.last_name ?? ""}`.trim() },
      { key: "email", label: "Email" },
      { key: "company_name", label: "Company", render: (c) => c.company_name || "—" },
      { key: "city", label: "City", render: (c) => c.shipping?.city ?? "—" },
    ],
  },
  invoices: {
    load: () => endpoints.v1.invoices({ per_page: 25 }),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "invoice_number", label: "Invoice #" },
      { key: "so_number", label: "Order #", render: (i) => i.so_number ?? "—" },
      { key: "customer", label: "Customer", render: (i) => i.customer || "—" },
      { key: "issued_date", label: "Issued", render: (i) => i.issued_date ?? "—" },
      { key: "total", label: "Total", render: (i) => money(i.total) },
      { key: "pdf", label: "", render: (i) => i.pdf_url
        ? <a href={i.pdf_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">PDF</a>
        : <span className="text-slate-400">—</span> },
    ],
  },
  vendors: {
    load: () => endpoints.v1.vendors({ per_page: 25 }),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "name", label: "Vendor" },
      { key: "email", label: "Email" },
      { key: "purchase_orders_count", label: "POs" },
      { key: "total_spend", label: "Spend", render: (v) => money(v.total_spend ?? 0) },
    ],
  },
  warehouses: {
    load: () => endpoints.v1.warehouses(),
    rows: (r) => (Array.isArray(r) ? r : []),
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "locations_count", label: "Locations" },
      { key: "inventory_levels_count", label: "Stocked SKUs" },
    ],
  },
  returns: {
    load: () => endpoints.v1.returns({ per_page: 25 }),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "rma_number", label: "RMA #" },
      { key: "status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "resolution", label: "Resolution" },
    ],
  },
  reports: {
    load: () => endpoints.v1.reports.inventoryValuation(),
    rows: (r) => r?.lines ?? [],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "quantity", label: "Qty" },
      { key: "value", label: "Stock Value", render: (l) => money(l.value) },
    ],
  },
  notifications: {
    load: () => endpoints.v1.notifications(),
    rows: (r) => r?.items ?? [],
    columns: [
      { key: "title", label: "Title" },
      { key: "level", label: "Level" },
      { key: "created_at", label: "When", render: (n) => new Date(n.created_at).toLocaleString() },
    ],
  },
  users: {
    load: () => endpoints.v1.users(),
    rows: (r) => r?.data ?? [],
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role", render: (u) => u.role?.label ?? "—" },
      { key: "is_active", label: "Active", render: (u) => (u.is_active ? "Yes" : "No") },
    ],
  },
  settings: {
    load: () => endpoints.v1.settings(),
    rows: (r) => (r && typeof r === "object" ? Object.values(r).flat() : []),
    columns: [
      { key: "key", label: "Setting" },
      { key: "value", label: "Value", render: (s) => String(s.value ?? "—") },
      { key: "group", label: "Group" },
    ],
  },
};

const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  shipped: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  confirmed: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
const statusPill = (s: string) =>
  STATUS_STYLE[s] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300";

/* ========================================================================= */
export default function ConsolePage() {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState("dashboard");
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: any }>({ loading: true });

  const isDashboard = active === "dashboard";
  const view = VIEWS[active];

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    const loader = isDashboard ? endpoints.v1.dashboard() : view?.load();
    if (!loader) { setState({ loading: false, data: null }); return; }
    loader
      .then((d: any) => alive && setState({ loading: false, data: d }))
      .catch((e: any) => alive && setState({ loading: false, error: e.message }));
    return () => { alive = false; };
  }, [active]); // eslint-disable-line

  const rows = useMemo(() => (view && state.data ? view.rows(state.data) : []), [view, state.data]);

  function selectModule(key: string) {
    if (ROUTES[key]) router.push(ROUTES[key]);
    else setActive(key);
  }
  async function handleLogout() { await logout(); router.replace("/login"); }

  const activeLabel = NAV_MODULES.find((m) => m.key === active)?.label ?? active;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 font-bold text-white">W</div>
          <div>
            <div className="text-sm font-semibold">WMS Console</div>
            <div className="text-[11px] text-slate-400">Enterprise Edition</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV_MODULES.map((m) => {
            const Icon = ICONS[m.icon] ?? Package;
            const on = active === m.key;
            return (
              <button
                key={m.key}
                onClick={() => selectModule(m.key)}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  on
                    ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={17} />
                <span className="flex-1 text-left">{m.label}</span>
                {ROUTES[m.key] && <ArrowUpRight size={13} className="text-slate-300 dark:text-slate-600" />}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => router.push("/activity-logs")}
              className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ScrollText size={17} />
              <span className="flex-1 text-left">Activity Logs</span>
              <ArrowUpRight size={13} className="text-slate-300 dark:text-slate-600" />
            </button>
          )}
        </nav>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold">{activeLabel}</h1>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Global search…"
                className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              onClick={toggle}
              title="Toggle theme"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                <div className="text-right leading-tight">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-[11px] capitalize text-slate-400">{user.role?.replace(/_/g, " ")}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
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
              <Loader2 className="animate-spin" size={18} /> Loading {activeLabel}…
            </div>
          )}

          {state.error && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={18} />
              <div>
                <div className="font-medium">Could not load {activeLabel}.</div>
                <div className="text-sm opacity-80">{state.error} — is the API running?</div>
              </div>
            </div>
          )}

          {!state.loading && !state.error && isDashboard && <Dashboard data={state.data} />}

          {!state.loading && !state.error && !isDashboard && view && (
            <DataTable columns={view.columns} rows={rows} />
          )}
        </section>
      </main>
    </div>
  );
}

/* ---- Dashboard ----------------------------------------------------------- */
function Dashboard({ data }: { data: any }) {
  const k = data?.kpis ?? {};
  const s = data?.sales ?? {};
  const trend = data?.revenue_trend ?? [];
  const recent = data?.recent_orders ?? [];
  const topCustomers = data?.top_customers ?? [];

  const cards = [
    { label: "Revenue", value: money(s.revenue ?? 0), icon: DollarSign, tint: "text-emerald-600 dark:text-emerald-400", sub: `${s.orders ?? 0} orders` },
    { label: "Profit", value: money(s.profit ?? 0), icon: TrendingUp, tint: "text-indigo-600 dark:text-indigo-400", sub: `${s.gross_margin_pct ?? 0}% margin` },
    { label: "Inventory Value", value: money(k.inventory_value ?? 0), icon: Boxes, tint: "text-sky-600 dark:text-sky-400", sub: `${num(k.products ?? 0)} products` },
    { label: "Avg Order", value: money(s.avg_order_value ?? 0), icon: ShoppingCart, tint: "text-violet-600 dark:text-violet-400", sub: `${num(k.customers ?? 0)} customers` },
    { label: "Sales Orders", value: num(k.sales_orders ?? 0), icon: ShoppingCart, tint: "text-slate-600 dark:text-slate-300", sub: `${num(k.pending_shipments ?? 0)} pending` },
    { label: "Purchase Orders", value: num(k.purchase_orders ?? 0), icon: PackageOpen, tint: "text-slate-600 dark:text-slate-300", sub: "" },
    { label: "Low Stock", value: num(k.low_stock ?? 0), icon: TriangleAlert, tint: "text-amber-600 dark:text-amber-400", sub: "at/under reorder" },
    { label: "Out of Stock", value: num(k.out_of_stock ?? 0), icon: PackageX, tint: "text-red-600 dark:text-red-400", sub: `${num(k.open_returns ?? 0)} open returns` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</span>
              <c.icon size={16} className={c.tint} />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</div>
            {c.sub && <div className="mt-1 text-xs text-slate-400">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold">Revenue — last 6 months</h3>
          <div className="h-64">
            {trend.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">No revenue data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" width={60}
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip formatter={(v: any) => money(Number(v))}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top customers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">Top customers</h3>
          {topCustomers.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No sales yet.</div>
          ) : (
            <ul className="space-y-3">
              {topCustomers.map((c: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{i + 1}</span>
                    {c.name || "—"}
                  </span>
                  <span className="tabular-nums font-medium">{money(c.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <Truck size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold">Recent orders</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Order #</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No orders yet.</td></tr>
            ) : recent.map((o: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-5 py-3 font-mono text-xs">{o.so_number}</td>
                <td className="px-5 py-3">{o.customer || "—"}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusPill(o.status)}`}>{String(o.status).replace(/_/g, " ")}</span></td>
                <td className="px-5 py-3 text-right tabular-nums">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- Generic data table -------------------------------------------------- */
function DataTable({ columns, rows }: { columns: Column[]; rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            {columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">No records yet.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
