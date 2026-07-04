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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, X, Search, Trash2, Truck, FileText, Loader2, RefreshCw, PackageCheck,
  UserPlus, Printer,
} from "lucide-react";
import { api, endpoints, ApiError } from "@/lib/api";
import { AppBar } from "@/components/AppBar";

const money = (n: number) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

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
export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState({ q: "", status: "", order_type: "", payment_method: "", tracking_status: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    ).toString();
    endpoints
      .salesOrders(params)
      .then((r: any) => setOrders(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <AppBar />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Sales Orders</h1>
            <p className="text-sm text-slate-500">Create, track, ship, and invoice orders.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> New Sales Order
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search SO# / customer…"
              className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {SO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select
            value={filters.order_type}
            onChange={(e) => setFilters((f) => ({ ...f, order_type: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="regular">Regular</option>
            <option value="dropship">Dropship</option>
          </select>
          <input
            value={filters.payment_method}
            onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
            placeholder="Payment method"
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={filters.tracking_status}
            onChange={(e) => setFilters((f) => ({ ...f, tracking_status: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Any tracking</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">SO #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created by</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto animate-spin" /> Loading…
                </td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-amber-700">{error}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No sales orders yet.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.so_number}</td>
                    <td className="px-4 py-3">
                      {o.customer ? `${o.customer.first_name} ${o.customer.last_name ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{o.order_type}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                        {String(o.status).replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.created_by ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {o.shipment?.tracking_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(o.totals?.grand_total ?? o.grand_total_cents ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(o)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateDrawer onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
      {editing && (
        <EditDrawer order={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

/* ================================================================== */
/* Create drawer                                                       */
/* ================================================================== */
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
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {custSearch.results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); custSearch.clear(); }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
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
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {prodSearch.results.map((p) => (
                      <button key={p.id}
                        onClick={() => { setLine(i, { product_id: p.id, product_name: p.name, unit_cost: p.default_price_cents ?? 0, buy_cost: p.default_cost_cents ?? 0 }); prodSearch.clear(); setProdRow(null); }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
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
                    className={`flex-1 py-2 ${l.line_type === t ? "bg-indigo-600 text-white" : "bg-white text-slate-500"}`}>
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

  async function invoice() {
    setBusy(true); setMsg(undefined);
    try {
      await endpoints.generateInvoice(order.id);
      setMsg("Invoice generated.");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
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

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          <button onClick={invoice} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-60">
            <FileText size={15} /> Invoice
          </button>
          <a href={endpoints.labelUrl(order.id)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm">
            <Printer size={15} /> Print Label
          </a>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Close</button>
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
      <div className={`h-full w-full ${width} overflow-y-auto bg-white p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
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
