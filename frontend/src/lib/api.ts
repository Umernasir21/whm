/**
 * Typed API client for the WMS Laravel backend.
 * Uses Sanctum token auth; token is stored in memory + localStorage.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

let token: string | null =
  typeof window !== "undefined" ? localStorage.getItem("wms_token") : null;

export function setToken(t: string | null) {
  token = t;
  if (typeof window !== "undefined") {
    if (t) localStorage.setItem("wms_token", t);
    else localStorage.removeItem("wms_token");
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    // Redirect to login only if we're not already there — otherwise the
    // bootstrap /me check on the login page would loop forever.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(err.message || "Request failed", res.status, err.errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>
  ) {
    super(message);
  }
}

/**
 * Open an authenticated PDF (invoice / label). The download routes require the
 * Bearer token, which a plain <a href> / new tab can't send — so we fetch the
 * bytes with auth and open them as an object URL.
 */
export async function openAuthedPdf(urlOrPath: string): Promise<void> {
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${BASE}${urlOrPath}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new ApiError("Could not open the document.", res.status);
  const blobUrl = URL.createObjectURL(await res.blob());
  window.open(blobUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Fetch an authenticated PDF and save it to disk with a filename. */
export async function downloadAuthedPdf(urlOrPath: string, filename: string): Promise<void> {
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${BASE}${urlOrPath}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new ApiError("Could not download the document.", res.status);
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b),
  put: <T>(p: string, b?: unknown) => request<T>("PUT", p, b),
  patch: <T>(p: string, b?: unknown) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};

/** Versioned API prefix for all enterprise modules. */
const V1 = "/v1";
const qs = (params: Record<string, unknown> = {}) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  });
  const str = s.toString();
  return str ? `?${str}` : "";
};

// ---- Domain types ----------------------------------------------------------
export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
}

export interface Customer {
  id: number;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  email: string;
  shipping: {
    address1: string | null; city: string | null;
    state: string | null; zip: string | null;
  };
}

export interface SalesOrder {
  id: number;
  so_number: string;
  order_type: "regular" | "dropship";
  status: "draft" | "confirmed" | "shipped" | "delivered" | "cancelled";
  totals: { subtotal: number; shipping: number; tax: number; grand_total: number };
  customer?: Customer;
  shipment?: {
    carrier: string | null; tracking_number: string | null;
    status: string; ship_from: Record<string, string | null>;
  };
  invoice?: { invoice_number: string; total: number; pdf_url: string | null };
  created_at: string;
}

export interface DashboardData {
  kpis: { sales_orders: number; purchase_orders: number; customers: number; pending_shipments: number };
  profit: { revenue: number; cost: number; profit: number; margin_pct: number };
  revenue_trend: { month: string; revenue: number }[];
  recent_orders: { so_number: string; customer: string; status: string; total: number }[];
}

// ---- Endpoint helpers ------------------------------------------------------
export const endpoints = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: any }>("/login", { email, password }),
  me: () => api.get("/me"),
  logout: () => api.post("/logout"),
  dashboard: () => api.get<DashboardData>("/dashboard"),
  customers: (q = "") => api.get<Paginated<Customer>>(`/customers?q=${encodeURIComponent(q)}`),
  createCustomer: (data: unknown) => api.post<{ data: Customer }>("/customers", data),
  updateCustomer: (id: number, data: unknown) => api.put<{ data: Customer }>(`/v1/customers/${id}`, data),
  salesOrders: (params = "") => api.get<Paginated<SalesOrder>>(`/sales-orders?${params}`),
  salesOrder: (id: number) => api.get<{ data: SalesOrder }>(`/sales-orders/${id}`),
  createSalesOrder: (data: unknown) => api.post<{ data: SalesOrder }>("/sales-orders", data),
  updateSalesOrder: (id: number, data: unknown) => api.put<{ data: SalesOrder }>(`/sales-orders/${id}`, data),
  generateInvoice: (soId: number) => api.post(`/sales-orders/${soId}/invoice`),
  /** Absolute URL for the shipping-label PDF (opened in a new tab). */
  labelUrl: (soId: number) => `${BASE}/v1/sales-orders/${soId}/label`,
  purchaseOrders: (params = "") => api.get(`/purchase-orders?${params}`),
  createPurchaseOrder: (data: unknown) => api.post("/purchase-orders", data),
  profit: (from?: string, to?: string) =>
    api.get(`/reports/profit${from ? `?from=${from}&to=${to}` : ""}`),

  // ---- v1 enterprise modules ----------------------------------------------
  v1: {
    dashboard: (params: { months?: number; from?: string; to?: string } = {}) => api.get(`${V1}/dashboard${qs(params)}`),
    search: (q: string) => api.get<{ results: any[] }>(`${V1}/search${qs({ q })}`),

    // Catalog
    products: (params = {}) => api.get(`${V1}/products${qs(params)}`),
    product: (id: number) => api.get(`${V1}/products/${id}`),
    createProduct: (d: unknown) => api.post(`${V1}/products`, d),
    updateProduct: (id: number, d: unknown) => api.put(`${V1}/products/${id}`, d),
    deleteProduct: (id: number) => api.del(`${V1}/products/${id}`),
    categories: () => api.get(`${V1}/categories`),
    createCategory: (d: unknown) => api.post(`${V1}/categories`, d),
    updateCategory: (id: number, d: unknown) => api.put(`${V1}/categories/${id}`, d),

    // Vendors
    vendors: (params = {}) => api.get(`${V1}/vendors${qs(params)}`),
    vendor: (id: number) => api.get(`${V1}/vendors/${id}`),
    createVendor: (d: unknown) => api.post(`${V1}/vendors`, d),
    updateVendor: (id: number, d: unknown) => api.put(`${V1}/vendors/${id}`, d),

    // Warehouses & inventory
    warehouses: () => api.get(`${V1}/warehouses`),
    createWarehouse: (d: unknown) => api.post(`${V1}/warehouses`, d),
    updateWarehouse: (id: number, d: unknown) => api.put(`${V1}/warehouses/${id}`, d),
    addLocation: (whId: number, d: unknown) => api.post(`${V1}/warehouses/${whId}/locations`, d),
    inventory: (params = {}) => api.get(`${V1}/inventory${qs(params)}`),
    lowStock: () => api.get(`${V1}/inventory/low-stock`),
    stockMovements: (params = {}) => api.get(`${V1}/inventory/movements${qs(params)}`),
    receiveStock: (d: unknown) => api.post(`${V1}/inventory/receive`, d),
    adjustStock: (d: unknown) => api.post(`${V1}/inventory/adjust`, d),
    transferStock: (d: unknown) => api.post(`${V1}/inventory/transfer`, d),

    // Purchasing
    receivePO: (id: number, d: unknown) => api.post(`${V1}/purchase-orders/${id}/receive`, d),
    updatePO: (id: number, d: unknown) => api.put(`${V1}/purchase-orders/${id}`, d),

    // Invoices
    invoices: (params = {}) => api.get(`${V1}/invoices${qs(params)}`),

    // Returns / RMA
    returns: (params = {}) => api.get(`${V1}/returns${qs(params)}`),
    createReturn: (d: unknown) => api.post(`${V1}/returns`, d),
    setReturnStatus: (id: number, d: unknown) => api.patch(`${V1}/returns/${id}/status`, d),

    // Notifications
    notifications: (unread = false) => api.get(`${V1}/notifications${qs({ unread })}`),
    markNotificationRead: (id: number) => api.patch(`${V1}/notifications/${id}/read`),
    markAllNotificationsRead: () => api.post(`${V1}/notifications/read-all`),

    // Reports
    reports: {
      sales: (p = {}) => api.get(`${V1}/reports/sales${qs(p)}`),
      purchases: (p = {}) => api.get(`${V1}/reports/purchases${qs(p)}`),
      inventoryValuation: () => api.get(`${V1}/reports/inventory-valuation`),
      stockMovement: (days = 90) => api.get(`${V1}/reports/stock-movement${qs({ days })}`),
      topCustomers: () => api.get(`${V1}/reports/top-customers`),
      topVendors: () => api.get(`${V1}/reports/top-vendors`),
    },

    // Administration
    users: () => api.get(`${V1}/users`),
    createUser: (d: unknown) => api.post(`${V1}/users`, d),
    updateUser: (id: number, d: unknown) => api.put(`${V1}/users/${id}`, d),
    deleteUser: (id: number) => api.del(`${V1}/users/${id}`),
    roles: () => api.get(`${V1}/roles`),
    // Role administration (admin only).
    rolesDetail: () => api.get(`${V1}/roles-detail`),
    permissions: () => api.get(`${V1}/permissions`),
    updateRolePermissions: (roleId: number, ids: number[]) =>
      api.put(`${V1}/roles/${roleId}/permissions`, { permissions: ids }),
    // Admin-only audit trail + login history.
    activityLogs: (params = {}) => api.get(`${V1}/activity-logs${qs(params)}`),
    loginHistory: () => api.get(`${V1}/login-history`),
    settings: () => api.get(`${V1}/settings`),
    saveSettings: (settings: unknown) => api.put(`${V1}/settings`, { settings }),
  },
};

/**
 * Navigation manifest for the enterprise shell — one entry per master module.
 * `perm` is the permission a user needs to see the item (checked via auth.can()).
 */
export const NAV_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", perm: "dashboard.view" },
  { key: "sales-orders", label: "Sales Orders", icon: "ShoppingCart", perm: "sales_orders.view" },
  { key: "purchase-orders", label: "Purchase Orders", icon: "PackageOpen", perm: "purchase_orders.view" },
  { key: "inventory", label: "Inventory", icon: "Boxes", perm: "inventory.view" },
  { key: "products", label: "Products", icon: "Package", perm: "products.view" },
  { key: "categories", label: "Categories", icon: "FolderTree", perm: "categories.view" },
  { key: "customers", label: "Customers", icon: "Users", perm: "customers.view" },
  { key: "invoices", label: "Invoices", icon: "FileText", perm: "sales_orders.view" },
  { key: "vendors", label: "Vendors", icon: "Factory", perm: "vendors.view" },
  { key: "warehouses", label: "Warehouses", icon: "Warehouse", perm: "warehouses.view" },
  { key: "returns", label: "Returns (RMA)", icon: "Undo2", perm: "returns.view" },
  { key: "reports", label: "Reports", icon: "BarChart3", perm: "reports.view" },
  { key: "notifications", label: "Notifications", icon: "Bell", perm: "dashboard.view" },
  { key: "users", label: "Users & Roles", icon: "ShieldCheck", perm: "users.view" },
  { key: "settings", label: "Settings", icon: "Settings", perm: "settings.view" },
] as const;
