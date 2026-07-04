"use client";
/**
 * Purchase Orders — the document's PO grid (Fig 10), live against the API.
 *
 *  • List with status/search filters (GET /purchase-orders)
 *  • Create drawer: vendor select, line items (product search, condition,
 *    quantity, unit cost, buy tax), live totals incl. PO Before/After Tax
 *    → POST /purchase-orders (auto PO#)
 *  • Receive drawer entry point (approve → receive posts to inventory)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Search, Trash2, Loader2, RefreshCw, PackageCheck } from "lucide-react";
import { endpoints, ApiError } from "@/lib/api";
import { AppBar } from "@/components/AppBar";

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const PO_STATUSES = [
  "draft", "pending_approval", "approved", "ordered",
  "partially_received", "received", "cancelled", "closed",
];

type Line = {
  product_id: number | null;
  product_name: string;
  condition: string;
  quantity: number;
  unit_cost: number;
  tax: number;
};
const BLANK: Line = { product_id: null, product_name: "", condition: "new", quantity: 1, unit_cost: 0, tax: 0 };

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
    endpoints
      .purchaseOrders(p)
      .then((r: any) => setRows(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <AppBar />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Purchase Orders</h1>
            <p className="text-sm text-slate-500">Track purchased inventory — product, condition, qty, tax, cost.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus size={16} /> New Purchase Order
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search PO#…" className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
          </div>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">PO #</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ordered</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-amber-700">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No purchase orders yet.</td></tr>
              ) : (
                rows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.po_number}</td>
                    <td className="px-4 py-3">{o.vendor?.name ?? "—"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{String(o.status).replace(/_/g, " ")}</span></td>
                    <td className="px-4 py-3 text-slate-500">{o.ordered_date ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(o.totals?.grand_total ?? o.grand_total_cents ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreatePO onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreatePO({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vendorId, setVendorId] = useState<number | "">("");
  const [vendors, setVendors] = useState<any[]>([]);
  const [status, setStatus] = useState("draft");
  const [orderedDate, setOrderedDate] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string[]>>();
  const [prodRow, setProdRow] = useState<number | null>(null);
  const [prodResults, setProdResults] = useState<any[]>([]);

  useEffect(() => { endpoints.v1.vendors({ per_page: 100 }).then((r: any) => setVendors(r.data ?? [])).catch(() => {}); }, []);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const productTotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0), [lines]);
  const taxTotal = useMemo(() => lines.reduce((s, l) => s + Number(l.tax), 0), [lines]);
  const poBefore = productTotal;
  const poAfter = productTotal + taxTotal;

  async function searchProducts(i: number, q: string) {
    setLine(i, { product_name: q, product_id: null });
    setProdRow(i);
    if (q.trim().length < 2) { setProdResults([]); return; }
    try { const r: any = await endpoints.v1.products({ q }); setProdResults(r.data ?? []); } catch { setProdResults([]); }
  }

  async function submit() {
    setSaving(true); setErr(undefined);
    try {
      await endpoints.createPurchaseOrder({
        vendor_id: vendorId || null,
        status,
        ordered_date: orderedDate || null,
        items: lines.filter((l) => l.product_name.trim()).map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          condition: l.condition,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost),
          tax: Number(l.tax),
        })),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? (e.errors ?? { _: [e.message] }) : { _: ["Failed"] });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><PackageCheck size={18} className="text-indigo-600" /> New Purchase Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <label className="text-xs text-slate-400">Vendor
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? +e.target.value : "")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
              <option value="">— Select vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize text-slate-900">
              {PO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Ordered date
            <input type="date" value={orderedDate} onChange={(e) => setOrderedDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Line items</h3>
        <div className="mb-1 flex gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span className="flex-[5]">Product</span><span className="flex-[2]">Condition</span>
          <span className="flex-[1] text-right">Qty</span><span className="flex-[2] text-right">Unit Cost</span>
          <span className="flex-[2] text-right">Tax</span><span className="w-6" />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-[5]">
                <input value={l.product_name} onChange={(e) => searchProducts(i, e.target.value)} placeholder="Product name or search…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                {prodRow === i && prodResults.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {prodResults.map((p) => (
                      <button key={p.id} onClick={() => { setLine(i, { product_id: p.id, product_name: p.name, unit_cost: p.default_cost_cents ?? 0 }); setProdResults([]); setProdRow(null); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
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
              <input type="number" min={0} step="0.01" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: +e.target.value })} className="flex-[2] rounded-lg border border-slate-200 px-2 py-2 text-right text-sm" />
              <input type="number" min={0} step="0.01" value={l.tax} onChange={(e) => setLine(i, { tax: +e.target.value })} className="flex-[2] rounded-lg border border-slate-200 px-2 py-2 text-right text-sm" />
              <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="grid w-6 place-items-center text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setLines((ls) => [...ls, { ...BLANK }])} className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
          <Plus size={14} /> Add line
        </button>

        <div className="mt-4 ml-auto max-w-xs space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Product Total</span><span className="tabular-nums">{money(productTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="tabular-nums">{money(taxTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">PO Before Tax</span><span className="tabular-nums">{money(poBefore)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold"><span>PO After Tax</span><span className="tabular-nums">{money(poAfter)}</span></div>
        </div>

        {err?._ && <p className="mt-2 text-sm text-red-600">{err._[0]}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving && <Loader2 className="animate-spin" size={15} />} Create PO
          </button>
        </div>
      </div>
    </div>
  );
}
