"use client";
/**
 * Global search — a prominent header input wired to the /search API. Debounced,
 * shows typed results in a dropdown, keyboard-navigable, and routes to the
 * relevant module on select.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, Package, Users, ShoppingCart, PackageOpen, Factory, Truck, CornerDownLeft,
} from "lucide-react";
import { endpoints } from "@/lib/api";

type Result = { type: string; id: number; title: string; subtitle: string; link: string };

const TYPE_META: Record<string, { icon: any; route: string; label: string }> = {
  product: { icon: Package, route: "/console?m=products", label: "Product" },
  customer: { icon: Users, route: "/console?m=customers", label: "Customer" },
  sales_order: { icon: ShoppingCart, route: "/sales-orders", label: "Sales Order" },
  purchase_order: { icon: PackageOpen, route: "/purchase-orders", label: "Purchase Order" },
  vendor: { icon: Factory, route: "/console?m=vendors", label: "Vendor" },
  shipment: { icon: Truck, route: "/sales-orders", label: "Shipment" },
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(() => {
      endpoints.v1
        .search(q)
        .then((r: any) => { setResults(r.results ?? []); setActive(0); })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // ⌘K / Ctrl-K focus, outside click, escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, []);

  function select(r: Result) {
    setOpen(false); setQ("");
    router.push(TYPE_META[r.type]?.route ?? "/console");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); select(results[active]); }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
      </div>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search orders, customers, products…"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:shadow-focus-ring dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-2xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">⌘K</kbd>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-overlay animate-scale-in dark:border-slate-800 dark:bg-slate-900">
          {busy && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No results for “{q}”.</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {results.map((r, i) => {
                const meta = TYPE_META[r.type] ?? { icon: Search, label: r.type };
                const Icon = meta.icon;
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => select(r)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                        active === i ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><Icon size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{r.title}</span>
                        <span className="block truncate text-xs text-slate-400">{r.subtitle}</span>
                      </span>
                      <span className="text-2xs font-medium uppercase tracking-wider text-slate-400">{meta.label}</span>
                      {active === i && <CornerDownLeft size={13} className="text-slate-300" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
