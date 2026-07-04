"use client";
/**
 * Enterprise Console — the dashboard + a live table for every master module.
 * The active module is driven by the ?m= query param (set by the shared
 * Sidebar), so navigation is consistent with the rest of the app. All data
 * comes from the Laravel API.
 */
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShoppingCart, PackageOpen, Boxes, Loader2, AlertTriangle,
  TrendingUp, DollarSign, TriangleAlert, Truck, PackageX, Eye, Download,
} from "lucide-react";
import { endpoints, NAV_MODULES, openAuthedPdf, downloadAuthedPdf } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => (n ?? 0).toLocaleString("en-US");

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
      {
        key: "actions", label: "Invoice", render: (i) => i.pdf_url ? (
          <div className="flex gap-3">
            <button onClick={() => openAuthedPdf(i.pdf_url)} className="flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"><Eye size={14} /> View</button>
            <button onClick={() => downloadAuthedPdf(i.pdf_url, `${i.invoice_number}.pdf`)} className="flex items-center gap-1 text-slate-500 hover:underline"><Download size={14} /> Download</button>
          </div>
        ) : <span className="text-slate-400">—</span>,
      },
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

export default function ConsolePage() {
  return (
    <Suspense fallback={null}>
      <ConsoleInner />
    </Suspense>
  );
}

function ConsoleInner() {
  const params = useSearchParams();
  const active = params.get("m") ?? "dashboard";
  const isDashboard = active === "dashboard";
  const view = VIEWS[active];
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: any }>({ loading: true });

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
  const title = NAV_MODULES.find((m) => m.key === active)?.label ?? "Dashboard";

  return (
    <AppLayout current={active}>
      <h1 className="mb-5 text-xl font-semibold">{title}</h1>

      {state.loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} /> Loading {title}…
        </div>
      )}

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={18} />
          <div>
            <div className="font-medium">Could not load {title}.</div>
            <div className="text-sm opacity-80">{state.error}</div>
          </div>
        </div>
      )}

      {!state.loading && !state.error && isDashboard && <Dashboard data={state.data} />}
      {!state.loading && !state.error && !isDashboard && view && <DataTable columns={view.columns} rows={rows} />}
    </AppLayout>
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
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" width={60} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

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
                  <span className="font-medium tabular-nums">{money(c.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">No records yet.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
