"use client";
/**
 * Roles & Permissions — admin-only editor. Each role is a card; permissions are
 * grouped by module with checkboxes. super_admin is locked (always all).
 */
import React, { useEffect, useState } from "react";
import { ShieldCheck, Loader2, ShieldAlert, Save, Check } from "lucide-react";
import { endpoints, ApiError } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

type Perm = { id: number; name: string; label: string };
type Role = { id: number; name: string; label: string; users_count: number; permissions: Perm[] };

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Record<string, Perm[]>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string>();

  function load() {
    setLoading(true);
    Promise.all([endpoints.v1.rolesDetail(), endpoints.v1.permissions()])
      .then(([r, p]: any) => { setRoles(r ?? []); setGroups(p ?? {}); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (forbidden) {
    return (
      <AppLayout current="roles">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <ShieldAlert size={40} className="text-amber-500" />
          <h1 className="text-lg font-semibold">Administrators only</h1>
          <p className="text-sm text-slate-500">Role management is restricted to admin accounts.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout current="roles">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck size={20} className="text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Grant or revoke what each role can do.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{error}</div>
        ) : (
          <div className="space-y-4">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} groups={groups} onSaved={load} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function RoleCard({ role, groups, onSaved }: { role: Role; groups: Record<string, Perm[]>; onSaved: () => void }) {
  const locked = role.name === "super_admin";
  const [selected, setSelected] = useState<Set<number>>(new Set(role.permissions.map((p) => p.id)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string>();

  const toggle = (id: number) => {
    if (locked) return;
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  async function save() {
    setSaving(true); setErr(undefined);
    try {
      await endpoints.v1.updateRolePermissions(role.id, [...selected]);
      setSaved(true);
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{role.label}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{role.name}</span>
            <span className="text-xs text-slate-400">· {role.users_count} users · {selected.size} permissions</span>
          </div>
          {locked && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Locked — super admin always has full access.</p>}
        </div>
        {!locked && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([module, perms]) => (
          <div key={module} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{module.replace(/_/g, " ")}</div>
            <div className="space-y-1.5">
              {perms.map((p) => {
                const action = p.name.split(".")[1] ?? p.name;
                const on = locked || selected.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-2 text-sm ${locked ? "opacity-60" : "cursor-pointer"}`}>
                    <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(p.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="capitalize">{action}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
