"use client";
/**
 * Reports — pick a report type and a period (weekly / monthly / custom), view
 * summary cards + a detail table, and download the detail as CSV.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, Download, FileSpreadsheet } from "lucide-react";
import { endpoints } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ---- period presets ------------------------------------------------------ */
function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  const start = new Date(now);
  if (preset === "week") start.setDate(now.getDate() - 7);
  else if (preset === "month") start.setMonth(now.getMonth() - 1);
  else if (preset === "quarter") start.setMonth(now.getMonth() - 3);
  else if (preset === "year") start.setFullYear(now.getFullYear() - 1);
  else start.setFullYear(now.getFullYear() - 5);
  return { from: iso(start), to };
}

type Col = { label: string; get: (r: any) => any };
type Report = {
  key: string; label: string; usesPeriod: boolean;
  load: (p: { from: string; to: string }) => Promise<any>;
  summary?: (d: any) => { label: string; value: string }[];
  table?: (d: any) => { rows: any[]; columns: Col[] };
};

const REPORTS: Report[] = [
  {
    key: "sales", label: "Sales Summary", usesPeriod: true,
    load: (p) => endpoints.v1.reports.sales(p),
    summary: (d) => [
      { label: "Orders", value: String(d.orders ?? 0) },
      { label: "Revenue", value: money(d.revenue) },
      { label: "Cost of Goods", value: money(d.cogs) },
      { label: "Profit", value: money(d.profit) },
      { label: "Gross Margin", value: `${d.gross_margin_pct ?? 0}%` },
      { label: "Avg Order Value", value: money(d.avg_order_value) },
    ],
  },
  {
    key: "purchases", label: "Purchases", usesPeriod: true,
    load: (p) => endpoints.v1.reports.purchases(p),
    summary: (d) => [
      { label: "Purchase Orders", value: String(d.purchase_orders ?? 0) },
      { label: "Total Spend", value: money(d.spend) },
    ],
  },
  {
    key: "valuation", label: "Inventory Valuation", usesPeriod: false,
    load: () => endpoints.v1.reports.inventoryValuation(),
    summary: (d) => [
      { label: "Total Stock Value", value: money(d.total_value) },
      { label: "Total Units", value: String(d.total_units ?? 0) },
    ],
    table: (d) => ({
      rows: d.lines ?? [],
      columns: [
        { label: "SKU", get: (r) => r.sku },
        { label: "Product", get: (r) => r.name },
        { label: "Quantity", get: (r) => r.quantity },
        { label: "Value", get: (r) => r.value },
      ],
    }),
  },
  {
    key: "top_customers", label: "Top Customers", usesPeriod: false,
    load: () => endpoints.v1.reports.topCustomers(),
    table: (d) => ({
      rows: Array.isArray(d) ? d : [],
      columns: [
        { label: "Customer", get: (r) => r.name },
        { label: "Orders", get: (r) => r.orders },
        { label: "Revenue", get: (r) => r.revenue },
      ],
    }),
  },
  {
    key: "top_vendors", label: "Top Vendors", usesPeriod: false,
    load: () => endpoints.v1.reports.topVendors(),
    table: (d) => ({
      rows: Array.isArray(d) ? d : [],
      columns: [
        { label: "Vendor", get: (r) => r.name },
        { label: "Purchase Orders", get: (r) => r.purchase_orders },
        { label: "Spend", get: (r) => r.spend },
      ],
    }),
  },
  {
    key: "movement", label: "Stock Movement", usesPeriod: false,
    load: () => endpoints.v1.reports.stockMovement(90),
    table: (d) => ({
      rows: [
        ...(d.fast_moving ?? []).map((r: any) => ({ ...r, band: "Fast" })),
        ...(d.slow_moving ?? []).map((r: any) => ({ ...r, band: "Slow" })),
        ...(d.dead_stock ?? []).map((r: any) => ({ ...r, band: "Dead" })),
      ],
      columns: [
        { label: "Band", get: (r) => r.band },
        { label: "SKU", get: (r) => r.sku },
        { label: "Product", get: (r) => r.name },
        { label: "Units Sold", get: (r) => r.units_sold },
      ],
    }),
  },
];

function toCSV(columns: Col[], rows: any[]): string {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(c.get(r))).join(","))].join("\n");
}
function download(filename: string, content: string, mime = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState("sales");
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState(presetRange("month"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const report = useMemo(() => REPORTS.find((r) => r.key === reportKey)!, [reportKey]);
  const range = preset === "custom" ? custom : presetRange(preset);

  const load = useCallback(() => {
    setLoading(true); setError(undefined);
    report.load(range)
      .then((d: any) => setData(d))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportKey, preset, custom.from, custom.to]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const summary = report.summary && data ? report.summary(data) : null;
  const table = report.table && data ? report.table(data) : null;

  function exportCsv() {
    if (!table) return;
    download(`${report.key}-${range.from}_to_${range.to}.csv`, toCSV(table.columns, table.rows));
  }
  function exportSummaryCsv() {
    if (!summary) return;
    download(`${report.key}-summary.csv`, toCSV([{ label: "Metric", get: (r) => r.label }, { label: "Value", get: (r) => r.value }], summary));
  }

  return (
    <AppLayout current="reports">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sales, purchases, inventory and more — with CSV export.</p>
          </div>
        </div>

        {/* Report type tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {REPORTS.map((r) => (
            <button key={r.key} onClick={() => setReportKey(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                reportKey === r.key
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Period + export */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {report.usesPeriod ? (
            <>
              {[["week", "This Week"], ["month", "This Month"], ["quarter", "Quarter"], ["year", "This Year"], ["custom", "Custom"]].map(([k, l]) => (
                <button key={k} onClick={() => setPreset(k)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    preset === k ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}>{l}</button>
              ))}
              {preset === "custom" && (
                <>
                  <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                </>
              )}
              <span className="text-xs text-slate-400">{range.from} → {range.to}</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">Point-in-time report</span>
          )}
          <div className="ml-auto flex gap-2">
            {summary && (
              <button onClick={exportSummaryCsv} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Download size={14} /> Summary CSV
              </button>
            )}
            {table && (
              <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                <FileSpreadsheet size={14} /> Download CSV
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{error}</div>
        ) : (
          <div className="space-y-6">
            {summary && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {summary.map((s) => (
                  <div key={s.label} className="card p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {table && (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-2xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>{table.columns.map((c) => <th key={c.label} className="px-4 py-3 font-medium">{c.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {table.rows.length === 0 ? (
                      <tr><td colSpan={table.columns.length} className="px-4 py-10 text-center text-slate-400">No data for this period.</td></tr>
                    ) : table.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {table.columns.map((c) => {
                          const v = c.get(r);
                          const isMoney = ["Value", "Revenue", "Spend"].includes(c.label);
                          return <td key={c.label} className="px-4 py-3 tabular-nums">{isMoney ? money(v) : String(v ?? "—")}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
