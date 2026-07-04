"use client";
/**
 * Sales Orders — the document's core workflow (Figures 1–8), live against the API.
 *
 *  • List with status/type/search filters (GET /sales-orders)
 *  • Create drawer: customer search+attach, line items with product search,
 *    payment fields, shipping/tax, live totals → POST /sales-orders (auto SO#)
 *  • Edit drawer: status transitions + shipment tracking (carrier/tracking/status)
 *    → PUT /sales-orders/{id}; generate invoice → POST .../invoice
 *
 * Money is entered in dollars; the API stores integer cents. This screen only
 * uses endpoints already verified working end-to-end.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, X, Search, Trash2, Truck, Loader2, RefreshCw, PackageCheck,
  UserPlus, Printer, Eye, Download, ShoppingCart, Upload, ChevronDown,
  ChevronLeft, ChevronRight, MoreHorizontal, Filter, Check, ArrowUpDown,
  DollarSign, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { api, endpoints, ApiError, openAuthedPdf, downloadAuthedPdf } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

const money = (n: number) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => (n ?? 0).toLocaleString("en-US");

/* Status pill styles for the table. */
const SO_STATUS_STYLE: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  shipped: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  partially_shipped: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  confirmed: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  approved: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  packed: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  ready_to_ship: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  returned: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  refunded: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};
const STATUS_DOT: Record<string, string> = {
  delivered: "bg-emerald-500", shipped: "bg-blue-500", partially_shipped: "bg-blue-500",
  confirmed: "bg-indigo-500", approved: "bg-indigo-500", packed: "bg-violet-500", ready_to_ship: "bg-violet-500",
  pending: "bg-amber-500", draft: "bg-slate-400", returned: "bg-orange-500", refunded: "bg-rose-500", cancelled: "bg-rose-500",
};
const CARRIER_TINT: Record<string, string> = {
  USPS: "text-blue-600", UPS: "text-amber-700", FedEx: "text-violet-600", DHL: "text-yellow-600", Other: "text-slate-500",
};

const SO_STATUSES = [
  "draft", "pending", "approved", "confirmed", "packed", "ready_to_ship",
  "partially_shipped", "shipped", "delivered", "cancelled", "returned", "refunded",
];
const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];
const SHIPMENT_STATUSES = ["pending", "shipped", "delivered"];

type Line = {
  product_id: number | null;
  product_name: string;
  condition: string;
  quantity: number;
  unit_cost: number;   // sale price
  buy_cost: number;    // purchase cost (→ PO Before Tax)
  line_type: "rg" | "ds"; // per-line Regular / Dropship
};

const BLANK_LINE: Line = {
  product_id: null, product_name: "", condition: "new",
  quantity: 1, unit_cost: 0, buy_cost: 0, line_type: "rg",
};

/* ------------------------------------------------------------------ */
/* Debounced entity search hook                                        */
/* ------------------------------------------------------------------ */
function useSearch<T>(fn: (q: string) => Promise<T[]>, min = 2) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < min) {
      setResults([]);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      fn(q)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setBusy(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]); // eslint-disable-line
  return { q, setQ, results, busy, clear: () => (setQ(""), setResults([])) };
}

/* ================================================================== */
/* ---- helpers ------------------------------------------------------------- */
const PENDING_STATES = new Set(["draft", "pending", "approved", "confirmed", "packed", "ready_to_ship", "partially_shipped"]);
const pct = (series: number[]) => {
  const v = series.filter((n) => typeof n === "number");
  if (v.length < 2 || !v[v.length - 2]) return null;
  return ((v[v.length - 1] - v[v.length - 2]) / Math.abs(v[v.length - 2])) * 100;
};
function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ i, v }));
  const id = `so-${color.replace("#", "")}`;
  if (d.length < 2) return <div className="h-8 w-16" />;
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function Delta({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-2xs font-semibold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(value).toFixed(1)}%
    </span>
  );
}
function toCsv(orders: any[]): string {
  const head = ["SO #", "Customer", "Email", "Type", "Status", "Created By", "Tracking", "Total", "Date"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = orders.map((o) => [
    o.so_number, `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.trim(), o.customer?.email ?? "",
    o.order_type, o.status, o.created_by ?? "", o.shipment?.tracking_number ?? "",
    o.totals?.grand_total ?? 0, o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
  ].map(esc).join(","));
  return [head.map(esc).join(","), ...rows].join("\n");
}

/* ================================================================== */
export default function SalesOrdersPage() {
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState({ q: "", status: "", order_type: "", payment_method: "", tracking_status: "" });
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    endpoints
      .salesOrders("per_page=500")
      .then((r: any) => setAll(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new")) setShowCreate(true);
  }, []);

  // KPIs + monthly series from all orders.
  const kpi = useMemo(() => {
    const byMonth: Record<string, { count: number; rev: number; delivered: number; pending: number }> = {};
    for (const o of all) {
      const m = (o.created_at ?? "").slice(0, 7);
      const b = (byMonth[m] ??= { count: 0, rev: 0, delivered: 0, pending: 0 });
      b.count++; b.rev += o.totals?.grand_total ?? 0;
      if (o.status === "delivered") b.delivered++;
      if (PENDING_STATES.has(o.status)) b.pending++;
    }
    const months = Object.keys(byMonth).sort();
    const s = (f: (b: any) => number) => months.map((m) => f(byMonth[m]));
    return {
      total: all.length, revenue: all.reduce((a, o) => a + (o.totals?.grand_total ?? 0), 0),
      delivered: all.filter((o) => o.status === "delivered").length,
      pending: all.filter((o) => PENDING_STATES.has(o.status)).length,
      countSeries: s((b) => b.count), revSeries: s((b) => b.rev),
      delSeries: s((b) => b.delivered), penSeries: s((b) => b.pending),
    };
  }, [all]);

  // Filter → sort → paginate.
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return all.filter((o) => {
      if (filters.status && o.status !== filters.status) return false;
      if (filters.order_type && o.order_type !== filters.order_type) return false;
      if (filters.payment_method && !(o.payment?.method ?? "").toLowerCase().includes(filters.payment_method.toLowerCase())) return false;
      if (filters.tracking_status && (o.shipment?.status ?? "") !== filters.tracking_status) return false;
      if (q) {
        const hay = `${o.so_number} ${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""} ${o.customer?.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, filters]);
  const sorted = useMemo(() => {
    const c = [...filtered].sort((a, b) => a.so_number.localeCompare(b.so_number));
    return sortDir === "desc" ? c.reverse() : c;
  }, [filtered, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageRows = sorted.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [filters, perPage, sortDir]);

  const activeChips = [
    filters.status && { k: "status", label: `Status: ${filters.status.replace(/_/g, " ")}` },
    filters.order_type && { k: "order_type", label: `Type: ${filters.order_type}` },
    filters.payment_method && { k: "payment_method", label: `Payment: ${filters.payment_method}` },
    filters.tracking_status && { k: "tracking_status", label: `Tracking: ${filters.tracking_status}` },
  ].filter(Boolean) as { k: string; label: string }[];

  const allChecked = pageRows.length > 0 && pageRows.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allChecked) pageRows.forEach((o) => n.delete(o.id)); else pageRows.forEach((o) => n.add(o.id));
    return n;
  });
  const toggleOne = (id: number) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const cards = [
    { label: "Total Orders", value: num(kpi.total), icon: ShoppingCart, chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400", spark: kpi.countSeries, color: "#6366f1", delta: pct(kpi.countSeries) },
    { label: "Total Revenue", value: money(kpi.revenue), icon: DollarSign, chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", spark: kpi.revSeries, color: "#10b981", delta: pct(kpi.revSeries) },
    { label: "Delivered Orders", value: num(kpi.delivered), icon: CheckCircle2, chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", spark: kpi.delSeries, color: "#0ea5e9", delta: pct(kpi.delSeries) },
    { label: "Pending Orders", value: num(kpi.pending), icon: Clock, chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", spark: kpi.penSeries, color: "#f59e0b", delta: pct(kpi.penSeries) },
  ];

  return (
    <AppLayout current="sales-orders">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">
            <ShoppingCart size={24} className="text-indigo-500" /> Sales Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create, track, ship, and invoice all your sales orders in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => download(`sales-orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(sorted))} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Download size={15} className="text-slate-400" /> Export
          </button>
          <button onClick={() => alert("Bulk import is not enabled in this build.")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Upload size={15} className="text-slate-400" /> Import
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:brightness-110 active:scale-[.98]">
            <Plus size={16} /> New Sales Order
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card card-hover p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.chip}`}><c.icon size={17} strokeWidth={2.25} /></span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</span>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{c.value}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs"><Delta value={c.delta} /><span className="text-slate-400">vs last month</span></div>
              </div>
              <MiniSpark data={c.spark} color={c.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card mb-4 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search SO # / customer…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" />
          </div>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <option value="">All statuses</option>
            {SO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select value={filters.order_type} onChange={(e) => setFilters((f) => ({ ...f, order_type: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <option value="">All types</option><option value="regular">Regular</option><option value="dropship">Dropship</option>
          </select>
          <input value={filters.payment_method} onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))} placeholder="Payment method" className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900" />
          <select value={filters.tracking_status} onChange={(e) => setFilters((f) => ({ ...f, tracking_status: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <option value="">Any tracking</option><option value="pending">Pending</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
          </select>
          <button onClick={load} title="Refresh" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><RefreshCw size={15} /></button>
        </div>
        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeChips.map((c) => (
              <span key={c.k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {c.label}
                <button onClick={() => setFilters((f) => ({ ...f, [c.k]: "" }))} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"><X size={12} /></button>
              </span>
            ))}
            <button onClick={() => setFilters({ q: "", status: "", order_type: "", payment_method: "", tracking_status: "" })} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Clear all</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-2xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></th>
                <th className="px-4 py-2.5 font-semibold"><button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">SO # <ArrowUpDown size={12} /></button></th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Created By</th>
                <th className="px-4 py-2.5 font-semibold">Tracking</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
              ) : error ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-amber-700">{error}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center">
                  <ShoppingCart size={28} className="mx-auto text-slate-300" />
                  <div className="mt-2 text-sm font-medium text-slate-500">No sales orders found</div>
                  <div className="text-xs text-slate-400">Try adjusting your filters or create a new order.</div>
                </td></tr>
              ) : pageRows.map((o) => (
                <tr key={o.id} className={`transition-colors ${selected.has(o.id) ? "bg-indigo-50/40 dark:bg-indigo-500/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{o.so_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium tracking-tight text-slate-800 dark:text-slate-100">{o.customer ? `${o.customer.first_name} ${o.customer.last_name ?? ""}`.trim() : "—"}</div>
                    <div className="text-xs text-slate-400">{o.customer?.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{o.order_type}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SO_STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[o.status] ?? "bg-slate-400"}`} />{String(o.status).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{o.created_by ?? "—"}</td>
                  <td className="px-4 py-3">
                    {o.shipment?.tracking_number ? (
                      <div>
                        <div className="font-mono text-xs text-slate-600 dark:text-slate-300">{o.shipment.tracking_number}</div>
                        {o.shipment.carrier && <div className={`text-2xs font-semibold ${CARRIER_TINT[o.shipment.carrier] ?? "text-slate-500"}`}>{o.shipment.carrier}</div>}
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(o.totals?.grand_total ?? 0)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-600 dark:text-slate-300">{o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                    <div className="text-2xs text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(o)} title="View / manage" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Eye size={15} /></button>
                      <button onClick={() => setEditing(o)} title="More" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"><MoreHorizontal size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, sorted.length)} of {sorted.length} results
              <select value={perPage} onChange={(e) => setPerPage(+e.target.value)} className="ml-2 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              per page
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronLeft size={15} /></button>
              {Array.from({ length: totalPages }).slice(0, 6).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-medium transition ${page === i + 1 ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"}`}>{i + 1}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {editing && <EditDrawer order={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </AppLayout>
  );
}

// CSV download helper (module scope).
function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function CreateDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customer, setCustomer] = useState<any | null>(null);
  const [orderType, setOrderType] = useState("regular");
  const [ids, setIds] = useState({ resource: "", resource_order_id: "", alternate_id: "" });
  const [payment, setPayment] = useState({ payment_method: "", transaction_id: "", payment_date: "", payment_comment: "" });
  const [shipping, setShipping] = useState(0);
  const [tax, setTax] = useState(0);
  const [buyTax, setBuyTax] = useState(0);
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string[]>>();
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const custSearch = useSearch<any>((q) => endpoints.customers(q).then((r: any) => r.data ?? []));
  const prodSearch = useSearch<any>((q) => endpoints.v1.products({ q }).then((r: any) => r.data ?? []));
  const [prodRow, setProdRow] = useState<number | null>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0), [lines]);
  const poBeforeTax = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.buy_cost, 0), [lines]);
  const poAfterTax = poBeforeTax + Number(buyTax);
  const grand = subtotal + Number(shipping) + Number(tax);
  const profit = subtotal - poBeforeTax;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  async function submit() {
    setErr(undefined);
    if (!customer) { setErr({ customer_id: ["Select a customer first."] }); return; }
    setSaving(true);
    try {
      await endpoints.createSalesOrder({
        customer_id: customer.id,
        order_type: orderType,
        ...ids,
        payment_method: payment.payment_method || null,
        transaction_id: payment.transaction_id || null,
        payment_date: payment.payment_date || null,
        payment_comment: payment.payment_comment || null,
        shipping: Number(shipping),
        tax: Number(tax),
        buy_tax: Number(buyTax),
        items: lines
          .filter((l) => l.product_name.trim())
          .map((l) => ({
            product_id: l.product_id,
            product_name: l.product_name,
            condition: l.condition,
            line_type: l.line_type, // per-line Ds/Rg
            quantity: Number(l.quantity),
            unit_cost: Number(l.unit_cost),
            buy_cost: Number(l.buy_cost),
          })),
      });
      onCreated();
    } catch (e: any) {
      setErr(e.errors ?? { _: [e.message] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title="New Sales Order" onClose={onClose} width="max-w-4xl">
      {/* Customer */}
      <Section title="Customer">
        {customer ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div>
              <div className="font-medium">{customer.first_name} {customer.last_name}</div>
              <div className="text-xs text-slate-500">{customer.email}</div>
            </div>
            <button onClick={() => setCustomer(null)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={custSearch.q}
                onChange={(e) => custSearch.setQ(e.target.value)}
                placeholder="Search customer by name/email…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {custSearch.results.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {custSearch.results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); custSearch.clear(); }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      {c.first_name} {c.last_name} <span className="text-slate-400">· {c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Fig 4 "+" — add a new customer inline */}
            <button
              onClick={() => setShowAddCustomer(true)}
              title="Add new customer"
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <UserPlus size={16} />
            </button>
          </div>
        )}
        {err?.customer_id && <p className="mt-1 text-xs text-red-600">{err.customer_id[0]}</p>}
      </Section>

      <Section title="Order details">
        <div className="grid grid-cols-2 gap-3">
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="regular">Regular</option>
            <option value="dropship">Dropship</option>
          </select>
          <input placeholder="Resource (e.g. marketplace)" value={ids.resource}
            onChange={(e) => setIds((p) => ({ ...p, resource: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="Resource Order ID" value={ids.resource_order_id}
            onChange={(e) => setIds((p) => ({ ...p, resource_order_id: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="Alternate ID" value={ids.alternate_id}
            onChange={(e) => setIds((p) => ({ ...p, alternate_id: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </Section>

      <Section title="Payment">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Payment method" value={payment.payment_method}
            onChange={(e) => setPayment((p) => ({ ...p, payment_method: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="Transaction ID" value={payment.transaction_id}
            onChange={(e) => setPayment((p) => ({ ...p, transaction_id: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <label className="text-xs text-slate-400">Payment date
            <input type="date" value={payment.payment_date}
              onChange={(e) => setPayment((p) => ({ ...p, payment_date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>
          <input placeholder="Payment comment" value={payment.payment_comment}
            onChange={(e) => setPayment((p) => ({ ...p, payment_comment: e.target.value }))}
            className="self-end rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </Section>

      {/* Line items */}
      <Section title="Line items">
        <div className="mb-1 flex gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span className="flex-[4]">Product</span>
          <span className="flex-[2]">Condition</span>
          <span className="flex-[1] text-right">Qty</span>
          <span className="flex-[2] text-right">Sale $</span>
          <span className="flex-[2] text-right">Buy $</span>
          <span className="flex-[2] text-center">Type</span>
          <span className="w-6" />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-[4]">
                <input
                  value={l.product_name}
                  onChange={(e) => { setLine(i, { product_name: e.target.value, product_id: null }); setProdRow(i); prodSearch.setQ(e.target.value); }}
                  placeholder="Product name or search…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {prodRow === i && prodSearch.results.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {prodSearch.results.map((p) => (
                      <button key={p.id}
                        onClick={() => { setLine(i, { product_id: p.id, product_name: p.name, unit_cost: p.default_price_cents ?? 0, buy_cost: p.default_cost_cents ?? 0 }); prodSearch.clear(); setProdRow(null); }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                        {p.name} <span className="text-slate-400">· {p.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={l.condition} onChange={(e) => setLine(i, { condition: e.target.value })} className="flex-[2] rounded-lg border border-slate-200 px-2 py-2 text-sm">
                <option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurb</option>
              </select>
              <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: +e.target.value })} className="flex-[1] rounded-lg border border-slate-200 px-2 py-2 text-right text-sm" />
              <input type="number" min={0} step="0.01" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: +e.target.value })} className="flex-[2] rounded-lg border border-slate-200 px-2 py-2 text-right text-sm" title="Sale price" />
              <input type="number" min={0} step="0.01" value={l.buy_cost} onChange={(e) => setLine(i, { buy_cost: +e.target.value })} className="flex-[2] rounded-lg border border-slate-200 px-2 py-2 text-right text-sm" title="Purchase cost" />
              {/* Per-line Ds/Rg toggle */}
              <div className="flex flex-[2] overflow-hidden rounded-lg border border-slate-200 text-xs">
                {(["rg", "ds"] as const).map((t) => (
                  <button key={t} onClick={() => setLine(i, { line_type: t })}
                    className={`flex-1 py-2 ${l.line_type === t ? "bg-indigo-600 text-white" : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                    {t === "rg" ? "Rg" : "Ds"}
                  </button>
                ))}
              </div>
              <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="grid w-6 place-items-center text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setLines((ls) => [...ls, { ...BLANK_LINE }])} className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
          <Plus size={14} /> Add line
        </button>
      </Section>

      {/* Totals */}
      <Section title="Totals">
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm text-slate-500">Shipping $
            <input type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-slate-500">Sales Tax $
            <input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-slate-500">Buy Tax $
            <input type="number" min={0} step="0.01" value={buyTax} onChange={(e) => setBuyTax(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <Row label="Product Total" value={money(subtotal)} />
          <Row label="Shipping" value={money(Number(shipping))} />
          <Row label="Tax" value={money(Number(tax))} />
          <div className="mt-1 border-t border-slate-200 pt-1">
            <Row label={<b>Grand total</b>} value={<b>{money(grand)}</b>} />
          </div>
          {/* Cost basis (Fig 1–2) */}
          <div className="mt-1 border-t border-slate-200 pt-1 text-slate-500">
            <Row label="PO Before Tax" value={money(poBeforeTax)} />
            <Row label="PO After Tax" value={money(poAfterTax)} />
            <Row
              label={<span className="text-emerald-700">Profit</span>}
              value={<span className={profit >= 0 ? "text-emerald-700" : "text-red-600"}>{money(profit)}</span>}
            />
          </div>
        </div>
      </Section>

      {err?._ && <p className="text-sm text-red-600">{err._[0]}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving && <Loader2 className="animate-spin" size={15} />} Create Order
        </button>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onCreated={(c) => { setCustomer(c); setShowAddCustomer(false); }}
        />
      )}
    </Drawer>
  );
}

/* ================================================================== */
/* Add Customer modal (Fig 3) — create + auto-attach                   */
/* ================================================================== */
function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const [f, setF] = useState<Record<string, string>>({
    first_name: "", last_name: "", company_name: "", email: "", phone: "", buyer_id: "",
    shipping_name: "", shipping_address1: "", shipping_address2: "",
    shipping_city: "", shipping_state: "", shipping_zip: "", shipping_country: "USA",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string[]>>();
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true); setErr(undefined);
    try {
      const res: any = await endpoints.createCustomer(f);
      onCreated(res.data ?? res);
    } catch (e) {
      setErr(e instanceof ApiError ? (e.errors ?? { _: [e.message] }) : { _: ["Failed"] });
    } finally { setSaving(false); }
  }

  // Plain render function (NOT a component) so inputs keep focus while typing.
  const fld = (k: string, label: string, required = false) => (
    <label className="block text-xs text-slate-400">
      {label}{required && <span className="text-red-500"> *</span>}
      <input value={f[k]} onChange={(e) => set(k, e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
      {err?.[k] && <span className="text-[11px] text-red-600">{err[k][0]}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-overlay animate-scale-in dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><UserPlus size={18} className="text-indigo-600" /> Add Customer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fld("first_name", "First name", true)}
          {fld("last_name", "Last name")}
          {fld("company_name", "Company")}
          {fld("email", "Email", true)}
          {fld("phone", "Phone")}
          {fld("buyer_id", "Buyer ID")}
        </div>
        <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Shipping details</h4>
        <div className="grid grid-cols-2 gap-3">
          {fld("shipping_name", "Shipping name")}
          {fld("shipping_address1", "Address 1", true)}
          {fld("shipping_address2", "Address 2")}
          {fld("shipping_zip", "Zip", true)}
          {fld("shipping_city", "City", true)}
          {fld("shipping_state", "State", true)}
          {fld("shipping_country", "Country", true)}
        </div>
        {err?._ && <p className="mt-2 text-sm text-red-600">{err._[0]}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving && <Loader2 className="animate-spin" size={15} />} Save &amp; Attach
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Edit drawer — status + shipment tracking + invoice                  */
/* ================================================================== */
function EditDrawer({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [ship, setShip] = useState({
    carrier: order.shipment?.carrier ?? "",
    tracking_number: order.shipment?.tracking_number ?? "",
    status: order.shipment?.status ?? "pending",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  async function save() {
    setBusy(true); setMsg(undefined);
    try {
      await endpoints.updateSalesOrder(order.id, {
        status,
        shipment: {
          carrier: ship.carrier || null,
          tracking_number: ship.tracking_number || null,
          status: ship.status,
        },
      });
      onSaved();
    } catch (e: any) {
      setMsg(e.message);
    } finally { setBusy(false); }
  }

  async function invoiceUrl(): Promise<string | undefined> {
    const res: any = await endpoints.generateInvoice(order.id); // idempotent
    return res?.data?.pdf_url;
  }
  async function viewInvoice() {
    setBusy(true); setMsg(undefined);
    try { const u = await invoiceUrl(); if (u) await openAuthedPdf(u); setMsg("Invoice opened in a new tab."); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function downloadInvoice() {
    setBusy(true); setMsg(undefined);
    try { const u = await invoiceUrl(); if (u) await downloadAuthedPdf(u, `${order.so_number}-invoice.pdf`); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function printLabel() {
    setBusy(true); setMsg(undefined);
    try { await openAuthedPdf(endpoints.labelUrl(order.id)); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={`Manage ${order.so_number}`} onClose={onClose} width="max-w-xl">
      <Section title="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize">
          {SO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </Section>

      <Section title="Shipment tracking">
        <div className="grid grid-cols-2 gap-3">
          <select value={ship.carrier} onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select carrier</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={ship.status} onChange={(e) => setShip((s) => ({ ...s, status: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize">
            {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={ship.tracking_number} onChange={(e) => setShip((s) => ({ ...s, tracking_number: e.target.value }))} placeholder="Tracking number" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <p className="mt-2 text-xs text-slate-400">Ship-from defaults to 21043 Warrender Terrace Ln, Richmond, TX 77407.</p>
      </Section>

      {msg && <p className="text-sm text-indigo-600">{msg}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button onClick={viewInvoice} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
            <Eye size={15} /> View Invoice
          </button>
          <button onClick={downloadInvoice} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
            <Download size={15} /> Download
          </button>
          <button onClick={printLabel} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
            <Printer size={15} /> Label
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Close</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Truck size={15} />} Save
          </button>
        </div>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */
function Drawer({ title, onClose, width, children }: { title: string; onClose: () => void; width: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className={`h-full w-full ${width} overflow-y-auto bg-white p-6 shadow-overlay animate-slide-in-right dark:bg-slate-900`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><PackageCheck size={18} className="text-indigo-600" /> {title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className="tabular-nums">{value}</span></div>;
}
