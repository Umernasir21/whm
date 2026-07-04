"use client";
/**
 * Activity Logs — admin-only audit trail. Shows who did what (create / update /
 * delete) across the system, with the acting user's name, the record touched,
 * the changed fields, IP, and time. Non-admins get a 403 from the API and see a
 * "restricted" notice instead of data.
 */
import React, { useEffect, useState } from "react";
import { ScrollText, Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { endpoints, ApiError } from "@/lib/api";

const ACTION_STYLE: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  updated: "bg-amber-100 text-amber-700",
  deleted: "bg-red-100 text-red-700",
};

export default function ActivityLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState({ action: "", subject_type: "" });

  function load() {
    setLoading(true);
    setError(undefined);
    setForbidden(false);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    endpoints.v1
      .activityLogs(params)
      .then((r: any) => setRows(r.data ?? []))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters]); // eslint-disable-line

  if (forbidden) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-900">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <ShieldAlert size={40} className="text-amber-500" />
          <h1 className="text-lg font-semibold">Administrators only</h1>
          <p className="text-sm text-slate-500">The activity log is restricted to admin accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-2">
          <ScrollText size={20} className="text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold">Activity Logs</h1>
            <p className="text-sm text-slate-500">Who created, updated, or deleted what — full audit trail.</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
          </select>
          <input
            value={filters.subject_type}
            onChange={(e) => setFilters((f) => ({ ...f, subject_type: e.target.value }))}
            placeholder="Filter by type (SalesOrder…)"
            className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-white">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Changes</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-amber-700">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No activity recorded yet.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(r.at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">{r.user}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${ACTION_STYLE[r.action] ?? "bg-slate-100 text-slate-600"}`}>{r.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.label ?? r.subject}</span>
                      <div className="text-xs text-slate-400">{r.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.changes && Object.keys(r.changes).length > 0
                        ? Object.entries(r.changes).slice(0, 4).map(([k, v]) => (
                            <div key={k}><span className="text-slate-400">{k}:</span> {String(v)}</div>
                          ))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.ip ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
