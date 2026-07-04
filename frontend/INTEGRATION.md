# Wiring the UI to the live API

`src/app/page.tsx` ships with an in-memory mock data layer so the UI runs standalone.
To connect it to the Laravel backend, replace the seed constants and local state
mutations with calls from `src/lib/api.ts`. The mapping is 1:1:

| Mock in page.tsx        | Live call                                    |
|-------------------------|----------------------------------------------|
| `SEED_SALES`            | `endpoints.salesOrders()` in a `useEffect`   |
| `SEED_CUSTOMERS`        | `endpoints.customers()`                      |
| `SEED_PO`               | `endpoints.purchaseOrders()`                 |
| `REVENUE_TREND`/profit  | `endpoints.dashboard()`                      |
| create customer modal   | `endpoints.createCustomer(form)`             |
| create sales order      | `endpoints.createSalesOrder(payload)`        |
| drawer save             | `endpoints.updateSalesOrder(id, payload)`    |
| invoice button          | `endpoints.generateInvoice(id)` then open `pdf_url` |

Gate write actions with `const { can } = useAuth()` — e.g. only show "New order"
when `can("sales_orders.create")`. Wrap the page in a redirect-to-login guard using
`useAuth().user`.

Example pattern:

```tsx
const [sales, setSales] = useState<SalesOrder[]>([]);
useEffect(() => { endpoints.salesOrders("per_page=50").then(r => setSales(r.data)); }, []);
```
