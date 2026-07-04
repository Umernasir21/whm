"use client";
/**
 * Enterprise Console — the dashboard + a live table for every master module.
 * The active module is driven by the ?m= query param (set by the shared
 * Sidebar), so navigation is consistent with the rest of the app. All data
 * comes from the Laravel API.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShoppingCart, PackageOpen, Boxes, Loader2, AlertTriangle,
  TrendingUp, DollarSign, TriangleAlert, PackageX, Eye, Download, Plus, X,
  MoreHorizontal, ArrowUpRight, ArrowDownRight, ArrowRight, Calendar, Zap, Activity,
  PackageCheck, Package, ChevronDown, Check, Users, Factory,
} from "lucide-react";
import { endpoints, NAV_MODULES, openAuthedPdf, downloadAuthedPdf, ApiError } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => (n ?? 0).toLocaleString("en-US");

type Column = { key: string; label: string; render?: (row: any) => React.ReactNode };
type Field = { key: string; label: string; type?: "text" | "number" | "email"; required?: boolean };
type FormConfig = {
  label: string;
  fields: Field[];
  create: (data: any) => Promise<any>;
  update?: (id: number, data: any) => Promise<any>;
  // Map a list row to the flat field values for the edit form (defaults to row).
  toForm?: (row: any) => Record<string, any>;
};
type ModuleView = { load: () => Promise<any>; rows: (r: any) => any[]; columns: Column[]; form?: FormConfig };

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
    form: {
      label: "Product",
      fields: [
        { key: "name", label: "Name", required: true },
        { key: "sku", label: "SKU (optional — auto if blank)" },
        { key: "default_price_cents", label: "Sale price", type: "number" },
        { key: "default_cost_cents", label: "Cost", type: "number" },
        { key: "reorder_point", label: "Reorder point", type: "number" },
      ],
      create: (d) => endpoints.v1.createProduct(d),
      update: (id, d) => endpoints.v1.updateProduct(id, d),
      toForm: (r) => ({
        name: r.name, sku: r.sku,
        default_price_cents: r.default_price_cents, default_cost_cents: r.default_cost_cents,
        reorder_point: r.reorder_point,
      }),
    },
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
    form: {
      label: "Category",
      fields: [
        { key: "name", label: "Name", required: true },
        { key: "description", label: "Description" },
      ],
      create: (d) => endpoints.v1.createCategory(d),
      update: (id, d) => endpoints.v1.updateCategory(id, d),
    },
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
    form: {
      label: "Customer",
      fields: [
        { key: "first_name", label: "First name", required: true },
        { key: "last_name", label: "Last name" },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "company_name", label: "Company" },
        { key: "phone", label: "Phone" },
        { key: "shipping_address1", label: "Address", required: true },
        { key: "shipping_city", label: "City", required: true },
        { key: "shipping_state", label: "State", required: true },
        { key: "shipping_zip", label: "Zip", required: true },
        { key: "shipping_country", label: "Country", required: true },
      ],
      create: (d) => endpoints.createCustomer(d),
      update: (id, d) => endpoints.updateCustomer(id, d),
      toForm: (r) => ({
        first_name: r.first_name, last_name: r.last_name, email: r.email,
        company_name: r.company_name, phone: r.phone,
        shipping_address1: r.shipping?.address1, shipping_city: r.shipping?.city,
        shipping_state: r.shipping?.state, shipping_zip: r.shipping?.zip,
        shipping_country: r.shipping?.country,
      }),
    },
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
    form: {
      label: "Vendor",
      fields: [
        { key: "name", label: "Vendor name", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone" },
        { key: "address1", label: "Address" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "country", label: "Country" },
      ],
      create: (d) => endpoints.v1.createVendor(d),
      update: (id, d) => endpoints.v1.updateVendor(id, d),
    },
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
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [dashMonths, setDashMonths] = useState(6);

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    const loader = isDashboard ? endpoints.v1.dashboard(dashMonths) : view?.load();
    if (!loader) { setState({ loading: false, data: null }); return; }
    loader
      .then((d: any) => alive && setState({ loading: false, data: d }))
      .catch((e: any) => alive && setState({ loading: false, error: e.message }));
    return () => { alive = false; };
  }, [active, refresh, dashMonths]); // eslint-disable-line

  // Open the create form when arriving via a Quick Action (?new=1).
  useEffect(() => {
    if (params.get("new") && VIEWS[active]?.form) setShowCreate(true);
  }, [active]); // eslint-disable-line

  const rows = useMemo(() => (view && state.data ? view.rows(state.data) : []), [view, state.data]);
  const title = NAV_MODULES.find((m) => m.key === active)?.label ?? "Dashboard";

  return (
    <AppLayout current={active}>
      {!isDashboard && (
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">{title}</h1>
          {view?.form && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.98]"
            >
              <Plus size={16} /> New {view.form.label}
            </button>
          )}
        </div>
      )}

      {showCreate && view?.form && (
        <FormModal config={view.form} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefresh((n) => n + 1); }} />
      )}
      {editRow && view?.form && (
        <FormModal config={view.form} row={editRow} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); setRefresh((n) => n + 1); }} />
      )}

      {state.loading && (isDashboard ? <DashboardSkeleton /> : <TableSkeleton cols={view?.columns.length ?? 5} />)}

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={18} />
          <div>
            <div className="font-medium">Could not load {title}.</div>
            <div className="text-sm opacity-80">{state.error}</div>
          </div>
        </div>
      )}

      {!state.loading && !state.error && isDashboard && <Dashboard data={state.data} months={dashMonths} onRange={setDashMonths} />}
      {!state.loading && !state.error && !isDashboard && view && (
        <DataTable columns={view.columns} rows={rows} onEdit={view.form?.update ? setEditRow : undefined} />
      )}
    </AppLayout>
  );
}

/* ---- Dashboard ----------------------------------------------------------- */
const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
];
const monthLabel = (ym: string) => {
  const [y, m] = (ym ?? "").split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${names[+m - 1]} ${y}` : ym;
};
const pctDelta = (series: number[]) => {
  const vals = series.filter((v) => typeof v === "number");
  if (vals.length < 2) return null;
  const prev = vals[vals.length - 2], last = vals[vals.length - 1];
  if (!prev) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ i, v }));
  const id = `sp-${color.replace("#", "")}`;
  if (d.length < 2) return <div className="h-9 w-20" />;
  return (
    <div className="h-9 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaChip({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold ${up ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Dashboard({ data, months, onRange }: { data: any; months: number; onRange: (m: number) => void }) {
  const k = data?.kpis ?? {};
  const s = data?.sales ?? {};
  const trend = (data?.revenue_trend ?? []).map((t: any) => ({ ...t, label: monthLabel(t.month) }));
  const recent = data?.recent_orders ?? [];
  const topCustomers = data?.top_customers ?? [];
  const lowStock = data?.low_stock_items ?? [];

  const revSeries = trend.map((t: any) => t.revenue);
  const profitSeries = trend.map((t: any) => t.profit);
  const orderSeries = trend.map((t: any) => t.orders);

  const primary = [
    { label: "Total Revenue", value: money(s.revenue ?? 0), icon: DollarSign, chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", sub: "vs last month", delta: pctDelta(revSeries), spark: revSeries, color: "#10b981" },
    { label: "Total Profit", value: money(s.profit ?? 0), icon: TrendingUp, chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400", sub: `${s.gross_margin_pct ?? 0}% margin`, delta: pctDelta(profitSeries), spark: profitSeries, color: "#8b5cf6" },
    { label: "Inventory Value", value: money(k.inventory_value ?? 0), icon: Boxes, chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", sub: `${num(k.products ?? 0)} products`, delta: null, spark: revSeries, color: "#0ea5e9" },
    { label: "Avg Order Value", value: money(s.avg_order_value ?? 0), icon: ShoppingCart, chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", sub: `${num(s.orders ?? 0)} orders`, delta: pctDelta(orderSeries), spark: orderSeries, color: "#f59e0b" },
  ];
  const secondary = [
    { label: "Sales Orders", value: num(k.sales_orders ?? 0), icon: ShoppingCart, chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400", sub: `${num(k.pending_shipments ?? 0)} pending` },
    { label: "Purchase Orders", value: num(k.purchase_orders ?? 0), icon: PackageOpen, chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", sub: "in flight" },
    { label: "Low Stock Items", value: num(k.low_stock ?? 0), icon: TriangleAlert, chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", sub: "at / under reorder" },
    { label: "Out of Stock", value: num(k.out_of_stock ?? 0), icon: PackageX, chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400", sub: `${num(k.open_returns ?? 0)} open returns` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">
            Dashboard <span className="text-2xl">&#128075;</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Here&apos;s what&apos;s happening with your warehouse today.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker months={months} onChange={onRange} />
          <QuickActionMenu />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primary.map((c) => (
          <div key={c.label} className="card card-hover p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.chip}`}><c.icon size={17} strokeWidth={2.25} /></span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</span>
              </div>
              <button className="text-slate-300 transition hover:text-slate-500 dark:text-slate-600"><MoreHorizontal size={18} /></button>
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{c.value}</div>
            <div className="mt-3 flex items-end justify-between">
              <div className="flex items-center gap-2 text-xs">
                <DeltaChip value={c.delta} />
                <span className="text-slate-400">{c.sub}</span>
              </div>
              <Sparkline data={c.spark} color={c.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {secondary.map((c) => (
          <div key={c.label} className="card card-hover p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.chip}`}><c.icon size={17} strokeWidth={2.25} /></span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</span>
              </div>
              <button className="text-slate-300 transition hover:text-slate-500 dark:text-slate-600"><MoreHorizontal size={18} /></button>
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{c.value}</div>
            <div className="mt-2 text-xs text-slate-400">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Revenue Overview</h3>
            <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">Last 6 months</span>
          </div>
          <div className="h-72">
            {trend.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">No revenue data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: -6, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-slate-100 dark:stroke-slate-800/70" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(1).replace(/\.0$/, "")}k`} />
                  <Tooltip
                    cursor={{ stroke: "#c7d2fe", strokeWidth: 1.5 }}
                    formatter={(v: any) => [money(Number(v)), "Revenue"]}
                    labelStyle={{ color: "#64748b", fontSize: 11 }}
                    contentStyle={{ borderRadius: 10, border: "1px solid rgb(226 232 240)", boxShadow: "0 8px 24px -8px rgb(15 23 42 / 0.15)", fontSize: 12, padding: "8px 12px" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#rev)" dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Top Customers</h3>
            <span className="text-xs font-medium text-slate-400">This month</span>
          </div>
          {topCustomers.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No sales yet.</div>
          ) : (
            <ul className="space-y-0.5">
              {topCustomers.map((c: any, i: number) => (
                <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xs font-semibold ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}>
                    {(c.name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium tracking-tight text-slate-800 dark:text-slate-100">{c.name || "—"}</span>
                    <span className="block text-xs text-slate-400">{num(c.orders)} orders</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{money(c.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-medium text-indigo-600 transition hover:gap-1.5 dark:text-indigo-400">
            View all customers <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Recent Sales Orders</h3>
            <span className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400">View all</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No orders yet.</div>
            ) : recent.slice(0, 5).map((o: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400">{o.so_number}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-2xs font-medium capitalize ${statusPill(o.status)}`}>{String(o.status).replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">{o.customer || "—"}</div>
                </div>
                <div className="text-right text-sm font-semibold tabular-nums">{money(o.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Low Stock Alerts</h3>
            <span className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400">View all</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-5 py-8 text-center text-sm text-slate-400">
                <PackageCheck size={22} className="text-emerald-400" /> All stock levels healthy.
              </div>
            ) : lowStock.map((p: any, i: number) => {
              const pct = p.reorder_point > 0 ? Math.min(100, Math.round((p.on_hand / p.reorder_point) * 100)) : 0;
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800"><Package size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium tracking-tight text-slate-800 dark:text-slate-100">{p.name}</div>
                    <div className="text-2xs text-slate-400">SKU: {p.sku}</div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${pct <= 25 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{p.on_hand}/{p.reorder_point}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Activity Feed</h3>
            <span className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400">View all</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No recent activity.</div>
            ) : recent.slice(0, 5).map((o: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400"><Activity size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Sales Order <span className="font-medium text-indigo-600 dark:text-indigo-400">{o.so_number}</span> is <span className="capitalize">{String(o.status).replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-0.5 text-2xs text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Dashboard header controls ------------------------------------------- */
function RangePicker({ months, onChange }: { months: number; onChange: (m: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  const opts: [number, string][] = [[3, "Last 3 months"], [6, "Last 6 months"], [12, "Last 12 months"]];
  const label = opts.find((o) => o[0] === months)?.[1] ?? `Last ${months} months`;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
        <Calendar size={15} className="text-slate-400" /> {label} <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-overlay animate-scale-in dark:border-slate-800 dark:bg-slate-900">
          {opts.map(([m, l]) => (
            <button key={m} onClick={() => { onChange(m); setOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${m === months ? "font-medium text-indigo-600 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {l} {m === months && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickActionMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  const items: { label: string; icon: any; to: string }[] = [
    { label: "New Sales Order", icon: ShoppingCart, to: "/sales-orders?new=1" },
    { label: "New Purchase Order", icon: PackageOpen, to: "/purchase-orders?new=1" },
    { label: "New Customer", icon: Users, to: "/console?m=customers&new=1" },
    { label: "New Product", icon: Package, to: "/console?m=products&new=1" },
    { label: "New Vendor", icon: Factory, to: "/console?m=vendors&new=1" },
  ];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:brightness-110 active:scale-[.98]">
        <Zap size={15} /> Quick Action <ChevronDown size={14} className="opacity-80" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-overlay animate-scale-in dark:border-slate-800 dark:bg-slate-900">
          {items.map((it) => (
            <button key={it.label} onClick={() => { setOpen(false); router.push(it.to); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <it.icon size={15} className="text-slate-400" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Generic data table -------------------------------------------------- */
function DataTable({ columns, rows, onEdit }: { columns: Column[]; rows: any[]; onEdit?: (row: any) => void }) {
  const [view, setView] = useState<any | null>(null);
  const colCount = columns.length + (onEdit ? 1 : 0);
  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-2xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              {columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-semibold">{c.label}</th>)}
              {onEdit && <th className="px-4 py-2.5 text-right font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-10 text-center text-slate-400">No records yet.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>)}
                {onEdit && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button onClick={() => setView(row)} className="text-slate-500 hover:underline dark:text-slate-400">View</button>
                      <button onClick={() => onEdit(row)} className="text-indigo-600 hover:underline dark:text-indigo-400">Edit</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view && <ViewModal columns={columns} row={view} onClose={() => setView(null)} onEdit={onEdit ? () => { onEdit(view); setView(null); } : undefined} />}
    </>
  );
}

/* ---- Skeleton loaders ---------------------------------------------------- */
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-7 w-7 rounded-lg" />
            </div>
            <div className="skeleton mt-3 h-7 w-24" />
            <div className="skeleton mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2"><div className="skeleton h-64 w-full rounded-lg" /></div>
        <div className="card space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      </div>
      <div className="card p-5"><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div></div>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="skeleton h-3 w-24" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton h-3.5" style={{ width: c === 0 ? "18%" : `${12 + ((c * 7) % 22)}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Read-only detail modal ---------------------------------------------- */
function ViewModal({ columns, row, onClose, onEdit }: { columns: Column[]; row: any; onClose: () => void; onEdit?: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h3 className="font-semibold">Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {columns.map((c) => (
            <div key={c.key} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
              <span className="text-slate-400">{c.label}</span>
              <span className="text-right">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</span>
            </div>
          ))}
        </div>
        {onEdit && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Close</button>
            <button onClick={onEdit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Edit</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Generic create / edit modal ----------------------------------------- */
function FormModal({ config, row, onClose, onSaved }: { config: FormConfig; row?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!row;
  const initial = useMemo(() => {
    if (!row) return {};
    const src = config.toForm ? config.toForm(row) : row;
    const out: Record<string, string> = {};
    for (const f of config.fields) out[f.key] = src[f.key] != null ? String(src[f.key]) : "";
    return out;
  }, [row]); // eslint-disable-line

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string[]>>();

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true); setErr(undefined);
    const payload: Record<string, any> = {};
    for (const f of config.fields) {
      const raw = values[f.key];
      if (raw === undefined || raw === "") continue;
      payload[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    try {
      if (isEdit && config.update) await config.update(row.id, payload);
      else await config.create(payload);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? (e.errors ?? { _: [e.message] }) : { _: ["Failed to save."] });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <Plus size={18} className="text-indigo-600" /> {isEdit ? `Edit ${config.label}` : `New ${config.label}`}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {config.fields.map((f) => (
            <label key={f.key} className="block text-xs text-slate-400">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
              <input
                type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {err?.[f.key] && <span className="text-[11px] text-red-600">{err[f.key][0]}</span>}
            </label>
          ))}
        </div>
        {err?._ && <p className="mt-3 text-sm text-red-600">{err._[0]}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving && <Loader2 className="animate-spin" size={15} />} {isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
