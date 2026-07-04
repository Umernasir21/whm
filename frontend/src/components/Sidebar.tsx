"use client";
/**
 * Dark navy sidebar with grouped navigation. Console modules deep-link into
 * /console?m=<key>; Sales/Purchase Orders + Reports have dedicated pages;
 * Roles & Activity Logs are admin-only. Active item gets a gradient pill.
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
  returns: { key: "returns", label: "Returns (RMA)", icon: Undo2 },
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
  { label: "Reports & Insights", keys: ["reports", "notifications"] },
  { label: "System", keys: ["users", "roles", "activity-logs", "settings"], adminOnly: true },
];

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
    <aside className="flex w-[248px] shrink-0 flex-col bg-[#0b1120] text-slate-300">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-bold text-white shadow-lg shadow-indigo-900/40">W</div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-white">Warehouse OS</div>
          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">Enterprise</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
        {GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500/90">
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
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                      on
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 font-medium text-white shadow-lg shadow-indigo-900/30"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon size={17} strokeWidth={2} className={on ? "text-white" : "text-slate-500 group-hover:text-slate-300"} />
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
