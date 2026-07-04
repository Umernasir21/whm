"use client";
/**
 * Shared left navigation used on every page. Console modules deep-link into
 * /console?m=<key>; Sales/Purchase Orders have dedicated pages; Activity Logs
 * is admin-only. `current` highlights the active item.
 */
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings,
  FileText, ScrollText, ArrowUpRight,
} from "lucide-react";
import { NAV_MODULES } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ICONS: Record<string, any> = {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings, FileText,
};

// Modules with their own dedicated route (everything else lives in the console).
const DEDICATED: Record<string, string> = {
  "sales-orders": "/sales-orders",
  "purchase-orders": "/purchase-orders",
};

export function Sidebar({ current }: { current: string }) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const go = (key: string) =>
    router.push(DEDICATED[key] ?? `/console?m=${key}`);

  const item = (key: string, label: string, Icon: any, external = false) => {
    const on = current === key;
    return (
      <button
        key={key}
        onClick={() => (key === "activity-logs" ? router.push("/activity-logs") : go(key))}
        className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
          on
            ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <Icon size={17} />
        <span className="flex-1 text-left">{label}</span>
        {external && <ArrowUpRight size={13} className="text-slate-300 dark:text-slate-600" />}
      </button>
    );
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 font-bold text-white">W</div>
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">WMS Console</div>
          <div className="text-[11px] text-slate-400">Enterprise Edition</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_MODULES.map((m) => item(m.key, m.label, ICONS[m.icon] ?? Package, !!DEDICATED[m.key]))}
        {isAdmin && item("activity-logs", "Activity Logs", ScrollText, true)}
      </nav>
    </aside>
  );
}
