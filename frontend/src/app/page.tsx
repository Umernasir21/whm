// @ts-nocheck — legacy mock-data prototype (kept for reference/design).
// The live, type-safe, API-wired screens are /console and /sales-orders.
"use client";
import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, ShoppingCart, PackageOpen, Users, FileText,
  Search, Sun, Moon, Plus, X, TrendingUp, Truck, Package,
  ChevronRight, Download, Filter, DollarSign, ArrowUpRight, Check,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ---------------------------------------------------------------------------
   WMS — Operations Console (interactive prototype)
   Design: cool precise "ops console" — slate/indigo base, electric-blue signal,
   tabular numerals for all figures. Signature: persistent profit pulse rail.
--------------------------------------------------------------------------- */

const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ---- Mock data -------------------------------------------------------------
const SEED_CUSTOMERS = [
  { id: 1, first_name: "Estelle", last_name: "Darcy", company: "Darcy Retail", email: "estelle@example.com", city: "Austin", state: "TX", zip: "73301" },
  { id: 2, first_name: "Samira", last_name: "Hadid", company: "", email: "samira@example.com", city: "Houston", state: "TX", zip: "77002" },
  { id: 3, first_name: "Jonas", last_name: "Peretti", company: "Northwind Co", email: "jonas@northwind.io", city: "Dallas", state: "TX", zip: "75201" },
  { id: 4, first_name: "Amina", last_name: "Okafor", company: "Okafor Labs", email: "amina@okafor.dev", city: "Plano", state: "TX", zip: "75023" },
];

const SEED_SALES = [
  { id: 1, so: "SO-00275808", customer: "Estelle Darcy", type: "regular", status: "delivered", total: 152.72, carrier: "USPS", tracking: "9400016461154542000", date: "2026-06-20" },
  { id: 2, so: "SO-00275809", customer: "Samira Hadid", type: "dropship", status: "shipped", total: 98.4, carrier: "UPS", tracking: "1Z999AA10123456784", date: "2026-06-22" },
  { id: 3, so: "SO-00275811", customer: "Jonas Peretti", type: "regular", status: "confirmed", total: 421.0, carrier: null, tracking: null, date: "2026-06-24" },
  { id: 4, so: "SO-00275812", customer: "Amina Okafor", type: "regular", status: "draft", total: 67.25, carrier: null, tracking: null, date: "2026-06-25" },
  { id: 5, so: "SO-00275813", customer: "Estelle Darcy", type: "dropship", status: "delivered", total: 289.9, carrier: "FedEx", tracking: "774889992345", date: "2026-06-26" },
];

const SEED_PO = [
  { id: 1, po: "PO-00004410", vendor: "Acme Wholesale", condition: "new", qty: 30, tax: 20.52, total: 904.52, status: "ordered", date: "2026-06-18" },
  { id: 2, po: "PO-00004411", vendor: "Globex Supply", condition: "refurbished", qty: 12, tax: 8.1, total: 341.1, status: "received", date: "2026-06-21" },
  { id: 3, po: "PO-00004412", vendor: "Acme Wholesale", condition: "new", qty: 50, tax: 44.0, total: 1444.0, status: "draft", date: "2026-06-25" },
];

const REVENUE_TREND = [
  { month: "Jan", revenue: 18400 }, { month: "Feb", revenue: 21200 },
  { month: "Mar", revenue: 19800 }, { month: "Apr", revenue: 26400 },
  { month: "May", revenue: 24100 }, { month: "Jun", revenue: 31200 },
];

// ---- Status pills ----------------------------------------------------------
const STATUS_STYLES = {
  draft:     { light: "bg-slate-100 text-slate-600", dark: "bg-slate-700/50 text-slate-300", dot: "bg-slate-400" },
  confirmed: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-500/15 text-amber-300", dot: "bg-amber-500" },
  shipped:   { light: "bg-blue-100 text-blue-700", dark: "bg-blue-500/15 text-blue-300", dot: "bg-blue-500" },
  delivered: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-500" },
  cancelled: { light: "bg-red-100 text-red-700", dark: "bg-red-500/15 text-red-300", dot: "bg-red-500" },
  ordered:   { light: "bg-indigo-100 text-indigo-700", dark: "bg-indigo-500/15 text-indigo-300", dot: "bg-indigo-500" },
  received:  { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-500" },
};

function StatusPill({ status, dark }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${dark ? s.dark : s.light}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---- App -------------------------------------------------------------------
export default function WMS() {
  const [dark, setDark] = useState(true);
  const [nav, setNav] = useState("dashboard");
  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [sales, setSales] = useState(SEED_SALES);
  const [toast, setToast] = useState(null);
  const [drawer, setDrawer] = useState(null);        // sales order detail
  const [showCustomer, setShowCustomer] = useState(false);
  const [showSO, setShowSO] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [soFilter, setSoFilter] = useState("all");
  const [query, setQuery] = useState("");

  const t = dark
    ? { bg: "bg-slate-950", panel: "bg-slate-900", panel2: "bg-slate-800/60", border: "border-slate-800", text: "text-slate-100", sub: "text-slate-400", faint: "text-slate-500", hover: "hover:bg-slate-800/60", input: "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500" }
    : { bg: "bg-slate-50", panel: "bg-white", panel2: "bg-slate-50", border: "border-slate-200", text: "text-slate-900", sub: "text-slate-500", faint: "text-slate-400", hover: "hover:bg-slate-100", input: "bg-white border-slate-300 text-slate-900 placeholder-slate-400" };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const profit = useMemo(() => {
    const rev = sales.reduce((a, s) => a + s.total, 0);
    const cost = SEED_PO.reduce((a, p) => a + p.total, 0);
    return { rev, cost, net: rev - cost, margin: rev ? ((rev - cost) / rev) * 100 : 0 };
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const okStatus = soFilter === "all" || s.status === soFilter;
      const okQ = !query || s.so.toLowerCase().includes(query.toLowerCase()) || s.customer.toLowerCase().includes(query.toLowerCase());
      return okStatus && okQ;
    });
  }, [sales, soFilter, query]);

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "sales", label: "Sales Orders", icon: ShoppingCart },
    { id: "purchase", label: "Purchase Orders", icon: PackageOpen },
    { id: "customers", label: "Customers", icon: Users },
    { id: "invoices", label: "Invoices", icon: FileText },
  ];

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex`} style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", fontFeatureSettings: "'tnum'" }}>
      {/* Sidebar */}
      <aside className={`w-64 shrink-0 border-r ${t.border} ${t.panel} flex flex-col`}>
        <div className={`h-16 flex items-center gap-2.5 px-5 border-b ${t.border}`}>
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold leading-tight tracking-tight">Warehouse</div>
            <div className={`text-[11px] ${t.faint} leading-tight`}>Operations Console</div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((n) => {
            const active = nav === n.id;
            return (
              <button key={n.id} onClick={() => setNav(n.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30" : `${t.sub} ${t.hover}`}`}>
                <n.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* Signature: profit pulse rail */}
        <div className="mt-auto p-3">
          <div className={`rounded-xl border ${t.border} ${t.panel2} p-4`}>
            <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${t.faint} mb-2`}>
              <TrendingUp className="h-3.5 w-3.5" /> Profit pulse
            </div>
            <div className="text-2xl font-semibold tracking-tight">{money(profit.net)}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {profit.margin.toFixed(1)}% margin
            </div>
            <div className={`mt-3 h-1.5 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"} overflow-hidden`}>
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${Math.min(profit.margin, 100)}%` }} />
            </div>
            <div className={`mt-2 flex justify-between text-[11px] ${t.faint}`}>
              <span>Rev {money(profit.rev)}</span>
              <span>Cost {money(profit.cost)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className={`h-16 shrink-0 border-b ${t.border} ${t.panel} flex items-center gap-4 px-6`}>
          <div className={`flex-1 flex items-center gap-2 rounded-lg border ${t.border} ${t.panel2} px-3 h-9 max-w-md`}>
            <Search className={`h-4 w-4 ${t.faint}`} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders, customers…"
              className="bg-transparent outline-none text-sm w-full placeholder:text-current placeholder:opacity-40" />
            <kbd className={`text-[10px] ${t.faint} border ${t.border} rounded px-1`}>⌘K</kbd>
          </div>
          <button onClick={() => setDark(!dark)} className={`h-9 w-9 grid place-items-center rounded-lg border ${t.border} ${t.hover}`}>
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <div className={`hidden sm:flex flex-col items-end text-[11px] leading-tight ${t.faint}`}>
            <span>US 6/26/2026 8:20 AM</span>
            <span>PK 6/26/2026 8:20 PM</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white text-sm font-semibold">A</div>
        </header>

        {/* Views */}
        <main className="flex-1 overflow-auto p-6">
          {nav === "dashboard" && <Dashboard t={t} dark={dark} profit={profit} sales={sales} />}
          {nav === "sales" && (
            <SalesView t={t} dark={dark} rows={filteredSales} filter={soFilter} setFilter={setSoFilter}
              onOpen={setDrawer} onNew={() => setShowSO(true)} />
          )}
          {nav === "purchase" && <PurchaseView t={t} dark={dark} />}
          {nav === "customers" && (
            <CustomersView t={t} dark={dark} rows={customers} onAdd={() => setShowCustomer(true)} />
          )}
          {nav === "invoices" && <InvoicesView t={t} dark={dark} rows={sales} onView={setShowInvoice} />}
        </main>
      </div>

      {/* Sales order drawer */}
      {drawer && <OrderDrawer t={t} dark={dark} order={drawer} onClose={() => setDrawer(null)}
        onInvoice={() => { setShowInvoice(drawer); setDrawer(null); }}
        onSave={(upd) => {
          setSales((prev) => prev.map((s) => (s.id === drawer.id ? { ...s, ...upd } : s)));
          setDrawer(null); flash("Sales order updated");
        }} />}

      {/* Add customer modal (Figure 3 workflow, modernized) */}
      {showCustomer && <CustomerModal t={t} dark={dark} onClose={() => setShowCustomer(false)}
        onSave={(c) => {
          setCustomers((prev) => [{ ...c, id: prev.length + 1 }, ...prev]);
          setShowCustomer(false); flash("Customer added");
        }} />}

      {/* New sales order modal */}
      {showSO && <SalesOrderModal t={t} dark={dark} customers={customers} onClose={() => setShowSO(false)}
        onSave={(o) => {
          const num = "SO-00275" + (814 + sales.length);
          setSales((prev) => [{ id: prev.length + 1, so: num, status: "draft", carrier: null, tracking: null, date: "2026-06-27", ...o }, ...prev]);
          setShowSO(false); flash(`Created ${num}`);
        }} />}

      {/* Invoice preview */}
      {showInvoice && <InvoicePreview t={t} dark={dark} order={showInvoice} onClose={() => setShowInvoice(null)} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 animate-[slideUp_.2s_ease]">
          <div className="h-5 w-5 rounded-full bg-emerald-500 grid place-items-center"><Check className="h-3.5 w-3.5" /></div>
          <span className="text-sm">{toast}</span>
        </div>
      )}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ---- Dashboard -------------------------------------------------------------
function Dashboard({ t, dark, profit, sales }) {
  const kpis = [
    { label: "Sales Orders", value: sales.length, icon: ShoppingCart, tint: "text-blue-400" },
    { label: "Purchase Orders", value: SEED_PO.length, icon: PackageOpen, tint: "text-indigo-400" },
    { label: "Open Shipments", value: sales.filter((s) => ["draft", "confirmed"].includes(s.status)).length, icon: Truck, tint: "text-amber-400" },
    { label: "Net Profit", value: money(profit.net), icon: DollarSign, tint: "text-emerald-400" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className={`text-sm ${t.sub}`}>Overview of orders, fulfillment, and profit.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl border ${t.border} ${t.panel} p-5`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs uppercase tracking-wider ${t.faint}`}>{k.label}</span>
              <k.icon className={`h-[18px] w-[18px] ${k.tint}`} />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 rounded-xl border ${t.border} ${t.panel} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold tracking-tight">Revenue trend</h2>
            <span className={`text-xs ${t.faint}`}>Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={REVENUE_TREND} margin={{ left: -12, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e293b" : "#e2e8f0"} vertical={false} />
              <XAxis dataKey="month" stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={dark ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip contentStyle={{ background: dark ? "#0f172a" : "#fff", border: `1px solid ${dark ? "#1e293b" : "#e2e8f0"}`, borderRadius: 10, fontSize: 12 }}
                formatter={(v) => [money(v), "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`rounded-xl border ${t.border} ${t.panel} p-5`}>
          <h2 className="font-semibold tracking-tight mb-4">Recent orders</h2>
          <div className="space-y-3">
            {sales.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.so}</div>
                  <div className={`text-xs ${t.faint} truncate`}>{s.customer}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm tabular-nums">{money(s.total)}</span>
                  <StatusPill status={s.status} dark={dark} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sales view ------------------------------------------------------------
function SalesView({ t, dark, rows, filter, setFilter, onOpen, onNew }) {
  const filters = ["all", "draft", "confirmed", "shipped", "delivered"];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Orders</h1>
          <p className={`text-sm ${t.sub}`}>{rows.length} orders</p>
        </div>
        <button onClick={onNew} className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 h-10 shadow-sm shadow-blue-600/30">
          <Plus className="h-4 w-4" /> New order
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter className={`h-4 w-4 ${t.faint}`} />
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${filter === f ? "bg-blue-600 text-white" : `border ${t.border} ${t.sub} ${t.hover}`}`}>
            {f}
          </button>
        ))}
      </div>

      <div className={`rounded-xl border ${t.border} ${t.panel} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${t.border} ${t.faint} text-xs uppercase tracking-wider`}>
              <th className="text-left font-medium px-5 py-3">SO Number</th>
              <th className="text-left font-medium px-5 py-3">Customer</th>
              <th className="text-left font-medium px-5 py-3">Type</th>
              <th className="text-left font-medium px-5 py-3">Carrier</th>
              <th className="text-right font-medium px-5 py-3">Total</th>
              <th className="text-left font-medium px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={() => onOpen(s)}
                className={`border-b ${t.border} last:border-0 cursor-pointer ${t.hover} transition`}>
                <td className="px-5 py-3.5 font-medium">{s.so}</td>
                <td className={`px-5 py-3.5 ${t.sub}`}>{s.customer}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs capitalize ${s.type === "dropship" ? "text-indigo-400" : t.sub}`}>{s.type}</span>
                </td>
                <td className={`px-5 py-3.5 ${t.sub}`}>{s.carrier || <span className={t.faint}>—</span>}</td>
                <td className="px-5 py-3.5 text-right tabular-nums font-medium">{money(s.total)}</td>
                <td className="px-5 py-3.5"><StatusPill status={s.status} dark={dark} /></td>
                <td className="px-5 py-3.5 text-right"><ChevronRight className={`h-4 w-4 ${t.faint} inline`} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className={`px-5 py-16 text-center ${t.faint}`}>
                <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No orders match this filter.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Purchase view ---------------------------------------------------------
function PurchaseView({ t, dark }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
        <p className={`text-sm ${t.sub}`}>Track purchased inventory, condition, and buying tax.</p>
      </div>
      <div className={`rounded-xl border ${t.border} ${t.panel} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${t.border} ${t.faint} text-xs uppercase tracking-wider`}>
              <th className="text-left font-medium px-5 py-3">PO Number</th>
              <th className="text-left font-medium px-5 py-3">Vendor</th>
              <th className="text-left font-medium px-5 py-3">Condition</th>
              <th className="text-right font-medium px-5 py-3">Qty</th>
              <th className="text-right font-medium px-5 py-3">Buying Tax</th>
              <th className="text-right font-medium px-5 py-3">Total</th>
              <th className="text-left font-medium px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {SEED_PO.map((p) => (
              <tr key={p.id} className={`border-b ${t.border} last:border-0 ${t.hover} transition`}>
                <td className="px-5 py-3.5 font-medium">{p.po}</td>
                <td className={`px-5 py-3.5 ${t.sub}`}>{p.vendor}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs capitalize px-2 py-0.5 rounded ${dark ? "bg-slate-800" : "bg-slate-100"}`}>{p.condition}</span>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums">{p.qty}</td>
                <td className="px-5 py-3.5 text-right tabular-nums">{money(p.tax)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums font-medium">{money(p.total)}</td>
                <td className="px-5 py-3.5"><StatusPill status={p.status} dark={dark} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Customers view --------------------------------------------------------
function CustomersView({ t, dark, rows, onAdd }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className={`text-sm ${t.sub}`}>{rows.length} customers</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 h-10 shadow-sm shadow-blue-600/30">
          <Plus className="h-4 w-4" /> Add customer
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((c) => (
          <div key={c.id} className={`rounded-xl border ${t.border} ${t.panel} p-5`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white font-semibold">
                {c.first_name[0]}{(c.last_name || " ")[0]}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{c.first_name} {c.last_name}</div>
                <div className={`text-xs ${t.faint} truncate`}>{c.company || "Individual"}</div>
              </div>
            </div>
            <div className={`mt-4 space-y-1 text-sm ${t.sub}`}>
              <div className="truncate">{c.email}</div>
              <div>{c.city}, {c.state} {c.zip}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Invoices view ---------------------------------------------------------
function InvoicesView({ t, dark, rows, onView }) {
  const invoiceable = rows.filter((r) => ["shipped", "delivered"].includes(r.status));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className={`text-sm ${t.sub}`}>Generate and download invoices for fulfilled orders.</p>
      </div>
      <div className={`rounded-xl border ${t.border} ${t.panel} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${t.border} ${t.faint} text-xs uppercase tracking-wider`}>
              <th className="text-left font-medium px-5 py-3">Invoice</th>
              <th className="text-left font-medium px-5 py-3">Order</th>
              <th className="text-left font-medium px-5 py-3">Customer</th>
              <th className="text-right font-medium px-5 py-3">Total</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoiceable.map((r, i) => (
              <tr key={r.id} className={`border-b ${t.border} last:border-0 ${t.hover} transition`}>
                <td className="px-5 py-3.5 font-medium">INV-{String(i + 1).padStart(5, "0")}</td>
                <td className={`px-5 py-3.5 ${t.sub}`}>{r.so}</td>
                <td className={`px-5 py-3.5 ${t.sub}`}>{r.customer}</td>
                <td className="px-5 py-3.5 text-right tabular-nums font-medium">{money(r.total)}</td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => onView(r)} className={`inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300`}>
                    <FileText className="h-3.5 w-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Order drawer ----------------------------------------------------------
function OrderDrawer({ t, dark, order, onClose, onSave, onInvoice }) {
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [tracking, setTracking] = useState(order.tracking || "");
  const [status, setStatus] = useState(order.status);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full max-w-md ${t.panel} border-l ${t.border} h-full overflow-auto animate-[slideIn_.2s_ease]`}>
        <div className={`sticky top-0 ${t.panel} border-b ${t.border} px-6 h-16 flex items-center justify-between`}>
          <div>
            <div className="font-semibold">{order.so}</div>
            <div className={`text-xs ${t.faint}`}>{order.customer}</div>
          </div>
          <button onClick={onClose} className={`h-9 w-9 grid place-items-center rounded-lg ${t.hover}`}><X className="h-4.5 w-4.5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${t.sub}`}>Order total</span>
            <span className="text-lg font-semibold tabular-nums">{money(order.total)}</span>
          </div>

          <div className="space-y-3">
            <div className={`text-xs uppercase tracking-wider ${t.faint}`}>Shipment tracking</div>
            <div>
              <label className={`text-xs ${t.sub}`}>Carrier</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none ${t.input}`}>
                <option value="">Select carrier</option>
                <option>USPS</option><option>UPS</option><option>FedEx</option>
              </select>
            </div>
            <div>
              <label className={`text-xs ${t.sub}`}>Tracking number</label>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="9400 0000 0000 0000"
                className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none ${t.input}`} />
            </div>
            <div>
              <label className={`text-xs ${t.sub}`}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none ${t.input}`}>
                <option value="draft">Draft</option><option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option><option value="delivered">Delivered</option>
              </select>
            </div>
          </div>

          <div className={`rounded-lg border ${t.border} ${t.panel2} p-4 text-sm`}>
            <div className={`text-xs uppercase tracking-wider ${t.faint} mb-1`}>Ship from</div>
            <div className={t.sub}>21043 Warrender Terrace Ln<br />Richmond, TX 77407</div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => onSave({ carrier: carrier || null, tracking: tracking || null, status })}
              className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium h-10">Save changes</button>
            <button onClick={onInvoice}
              className={`rounded-lg border ${t.border} ${t.hover} text-sm font-medium h-10 px-4 flex items-center gap-2`}>
              <FileText className="h-4 w-4" /> Invoice
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:none}}`}</style>
    </div>
  );
}

// ---- Customer modal --------------------------------------------------------
function CustomerModal({ t, dark, onClose, onSave }) {
  const [f, setF] = useState({ first_name: "", last_name: "", company: "", email: "", city: "", state: "", zip: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.first_name && f.email;
  return (
    <Modal t={t} onClose={onClose} title="Add customer" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field t={t} label="First name *" value={f.first_name} onChange={set("first_name")} placeholder="Estelle" />
        <Field t={t} label="Last name" value={f.last_name} onChange={set("last_name")} placeholder="Darcy" />
        <Field t={t} label="Company" value={f.company} onChange={set("company")} placeholder="Darcy Retail" />
        <Field t={t} label="Email *" value={f.email} onChange={set("email")} placeholder="estelle@example.com" />
      </div>
      <div className={`mt-5 mb-3 text-xs uppercase tracking-wider ${t.faint}`}>Shipping details</div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field t={t} label="City" value={f.city} onChange={set("city")} placeholder="Austin" />
        <Field t={t} label="State" value={f.state} onChange={set("state")} placeholder="TX" />
        <Field t={t} label="Zip" value={f.zip} onChange={set("zip")} placeholder="73301" />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={`rounded-lg border ${t.border} ${t.hover} text-sm font-medium h-10 px-4`}>Cancel</button>
        <button disabled={!valid} onClick={() => onSave(f)}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium h-10 px-5">Save customer</button>
      </div>
    </Modal>
  );
}

// ---- Sales order modal -----------------------------------------------------
function SalesOrderModal({ t, dark, customers, onClose, onSave }) {
  const [customer, setCustomer] = useState("");
  const [type, setType] = useState("regular");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const total = (Number(qty) || 0) * (Number(price) || 0);
  const valid = customer && product && price;
  return (
    <Modal t={t} onClose={onClose} title="New sales order" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={`text-xs ${t.sub}`}>Customer *</label>
          <select value={customer} onChange={(e) => setCustomer(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none ${t.input}`}>
            <option value="">Search for a customer</option>
            {customers.map((c) => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className={`text-xs ${t.sub}`}>Order type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none ${t.input}`}>
            <option value="regular">Regular</option><option value="dropship">Dropship</option>
          </select>
        </div>
      </div>
      <div className={`mt-5 mb-3 text-xs uppercase tracking-wider ${t.faint}`}>Line item</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2">
          <Field t={t} label="Product *" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Wireless Headphones" />
        </div>
        <Field t={t} label="Qty" value={qty} onChange={(e) => setQty(e.target.value)} type="number" />
        <Field t={t} label="Unit price *" value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="49.99" />
      </div>
      <div className={`mt-5 flex items-center justify-between rounded-lg border ${t.border} ${t.panel2} px-4 py-3`}>
        <span className={`text-sm ${t.sub}`}>Order total</span>
        <span className="text-lg font-semibold tabular-nums">{money(total)}</span>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={`rounded-lg border ${t.border} ${t.hover} text-sm font-medium h-10 px-4`}>Cancel</button>
        <button disabled={!valid} onClick={() => onSave({ customer, type, total })}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium h-10 px-5">Create order</button>
      </div>
    </Modal>
  );
}

// ---- Invoice preview -------------------------------------------------------
function InvoicePreview({ t, dark, order, onClose }) {
  const sub = order.total * 0.9, ship = order.total * 0.05, tax = order.total * 0.05;
  return (
    <Modal t={t} onClose={onClose} title="Invoice preview" wide>
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white text-slate-900">
        <div className="bg-blue-800 text-white px-8 py-6 flex items-start justify-between">
          <h2 className="text-3xl font-bold tracking-widest">INVOICE</h2>
          <div className="text-right text-sm">NO: INV-{String(order.id).padStart(5, "0")}</div>
        </div>
        <div className="p-8">
          <div className="flex justify-between mb-6">
            <div>
              <div className="text-blue-800 font-bold text-sm mb-1">Bill To:</div>
              <div className="text-sm text-slate-600 leading-relaxed">{order.customer}<br />123 Anywhere St<br />Austin, TX 73301</div>
            </div>
            <div className="text-right">
              <div className="text-blue-800 font-bold text-sm mb-1">From:</div>
              <div className="text-sm text-slate-600 leading-relaxed">Warehouse Fulfillment<br />21043 Warrender Terrace Ln<br />Richmond, TX 77407</div>
            </div>
          </div>
          <div className="text-sm text-slate-500 mb-4">Order: {order.so} &nbsp;·&nbsp; Date: 26 Jun 2026</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100"><td className="px-3 py-2">Wireless Headphones</td><td className="px-3 py-2 text-right tabular-nums">2</td><td className="px-3 py-2 text-right tabular-nums">{money(order.total * 0.33)}</td><td className="px-3 py-2 text-right tabular-nums">{money(order.total * 0.66)}</td></tr>
              <tr className="bg-slate-50"><td className="px-3 py-2">USB-C Cable</td><td className="px-3 py-2 text-right tabular-nums">3</td><td className="px-3 py-2 text-right tabular-nums">{money(order.total * 0.08)}</td><td className="px-3 py-2 text-right tabular-nums">{money(order.total * 0.24)}</td></tr>
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <table className="text-sm w-56">
              <tbody className="text-slate-600">
                <tr><td className="px-3 py-1">Subtotal</td><td className="px-3 py-1 text-right tabular-nums">{money(sub)}</td></tr>
                <tr><td className="px-3 py-1">Shipping</td><td className="px-3 py-1 text-right tabular-nums">{money(ship)}</td></tr>
                <tr><td className="px-3 py-1">Tax</td><td className="px-3 py-1 text-right tabular-nums">{money(tax)}</td></tr>
                <tr className="bg-blue-800 text-white font-semibold"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right tabular-nums">{money(order.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className={`rounded-lg border ${t.border} ${t.hover} text-sm font-medium h-10 px-4`}>Close</button>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium h-10 px-5">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>
    </Modal>
  );
}

// ---- Shared primitives -----------------------------------------------------
function Modal({ t, title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${t.panel} border ${t.border} rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-auto shadow-2xl animate-[pop_.18s_ease]`}>
        <div className={`sticky top-0 ${t.panel} border-b ${t.border} px-6 h-14 flex items-center justify-between`}>
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className={`h-8 w-8 grid place-items-center rounded-lg ${t.hover}`}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
      <style>{`@keyframes pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Field({ t, label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className={`text-xs ${t.sub}`}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={`mt-1 w-full rounded-lg border px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${t.input}`} />
    </div>
  );
}
