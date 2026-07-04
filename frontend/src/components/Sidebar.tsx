"use client";
/**
 * Grouped left navigation. Console modules deep-link into /console?m=<key>;
 * Sales/Purchase Orders + Reports have dedicated pages; Roles & Activity Logs
 * are admin-only. Active item gets an accent bar + soft pill.
 */
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, PackageOpen, Boxes, Package, FolderTree,
  Users, Factory, Warehouse, Undo2, BarChart3, Bell, ShieldCheck, Settings,
  FileText, ScrollText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type Item = { key: string; label: string; icon: any };

const ITEM: Record<string, Item> = {
  dashboard: { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  "sales-orders": { key: "sales-orders", label: "Sales Orders", icon: ShoppingCart },
  invoices: { key: "invoices", label: "Invoices", icon: FileText },
  customers: { key: "customers", label: "Customers", icon: Users },
  returns: { key: "returns", label: "Returns", icon: Undo2 },
  "purchase-orders": { key: "purchase-orders", label: "Purchase Orders", icon: PackageOpen },
  vendors: { key: "vendors", label: "Vendors", icon: Factory },
  inventory: { key: "inventory", label: "Inventory", icon: Boxes },
  products: { key: "products", label: "Products", icon: Package },
  categories: { key: "categories", label: "Categories", icon: FolderTree },
  warehouses: { key: "warehouses", label: "Warehouses", icon: Warehouse },
  reports: { key: "reports", label: "Reports", icon: BarChart3 },
  notifications: { key: "notifications", label: "Notifications", icon: Bell },
  users: { key: "users", label: "Users", icon: Users },
  roles: { key: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  "activity-logs": { key: "activity-logs", label: "Activity Logs", icon: ScrollText },
  settings: { key: "settings", label: "Settings", icon: Settings },
};

const GROUPS: { label: string | null; keys: string[]; adminOnly?: boolean }[] = [
  { label: null, keys: ["dashboard"] },
  { label: "Sales", keys: ["sales-orders", "invoices", "customers", "returns"] },
  { label: "Purchasing", keys: ["purchase-orders", "vendors"] },
  { label: "Inventory", keys: ["inventory", "products", "categories", "warehouses"] },
  { label: "Insights", keys: ["reports", "notifications"] },
  { label: "Administration", keys: ["users", "roles", "activity-logs", "settings"], adminOnly: true },
];

// Routes with a dedicated page (rest live inside the console via ?m=).
const DEDICATED: Record<string, string> = {
  "sales-orders": "/sales-orders",
  "purchase-orders": "/purchase-orders",
  reports: "/reports",
  roles: "/roles",
  "activity-logs": "/activity-logs",
};

export function Sidebar({ current }: { current: string }) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const go = (key: string) => router.push(DEDICATED[key] ?? `/console?m=${key}`);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm">W</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">Warehouse OS</div>
          <div className="text-2xs font-medium uppercase tracking-wider text-slate-400">Enterprise</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-1">
        {GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="mb-1 px-2.5 text-2xs font-semibold uppercase tracking-wider text-slate-400/90 dark:text-slate-500">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.keys.map((key) => {
                const it = ITEM[key];
                if (!it) return null;
                const Icon = it.icon;
                const on = current === key;
                return (
                  <button
                    key={key}
                    onClick={() => go(key)}
                    className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm transition-colors duration-150 ${
                      on
                        ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                    }`}
                  >
                    {on && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
                    <Icon size={16} strokeWidth={2} className={on ? "" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"} />
                    <span className="flex-1 text-left tracking-tight">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
