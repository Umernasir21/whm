<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\InventoryLevel;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;

/**
 * Analytics/report queries. Everything returns plain arrays (cents → dollars at
 * the edge) ready for the API layer. Heavy aggregates are grouped in SQL rather
 * than pulled into PHP.
 */
class ReportService
{
    public function salesSummary(?string $from = null, ?string $to = null): array
    {
        $q = SalesOrder::query()->whereNotIn('status', ['draft', 'cancelled']);
        $this->betweenDates($q, $from, $to);

        $row = $q->selectRaw('
            COUNT(*) as orders,
            COALESCE(SUM(grand_total_cents),0) as revenue,
            COALESCE(SUM(cost_of_goods_cents),0) as cogs,
            COALESCE(SUM(profit_cents),0) as profit
        ')->first();

        $revenue = (int) $row->revenue;
        $profit = (int) $row->profit;

        return [
            'orders' => (int) $row->orders,
            'revenue' => $revenue / 100,
            'cogs' => (int) $row->cogs / 100,
            'profit' => $profit / 100,
            'gross_margin_pct' => $revenue > 0 ? round($profit / $revenue * 100, 2) : 0,
            'avg_order_value' => $row->orders > 0 ? round($revenue / $row->orders / 100, 2) : 0,
        ];
    }

    public function purchaseSummary(?string $from = null, ?string $to = null): array
    {
        $q = PurchaseOrder::query()->whereNotIn('status', ['draft', 'cancelled']);
        $this->betweenDates($q, $from, $to);
        $row = $q->selectRaw('COUNT(*) as pos, COALESCE(SUM(grand_total_cents),0) as spend')->first();

        return ['purchase_orders' => (int) $row->pos, 'spend' => (int) $row->spend / 100];
    }

    /** Total value of stock on hand at weighted-average cost. */
    public function inventoryValuation(): array
    {
        $rows = InventoryLevel::query()
            ->join('products', 'products.id', '=', 'inventory_levels.product_id')
            ->selectRaw('
                products.id, products.sku, products.name,
                SUM(inventory_levels.quantity_on_hand) as qty,
                SUM(inventory_levels.quantity_on_hand * inventory_levels.avg_cost_cents) as value
            ')
            ->groupBy('products.id', 'products.sku', 'products.name')
            ->having('qty', '>', 0)
            ->orderByDesc('value')
            ->get();

        return [
            'total_value' => (int) $rows->sum('value') / 100,
            'total_units' => (int) $rows->sum('qty'),
            'lines' => $rows->map(fn ($r) => [
                'sku' => $r->sku, 'name' => $r->name,
                'quantity' => (int) $r->qty, 'value' => (int) $r->value / 100,
            ]),
        ];
    }

    /** Fast/slow/dead movers by units sold in a trailing window. */
    public function stockMovementAnalysis(int $days = 90): array
    {
        $since = now()->subDays($days);
        $sold = DB::table('stock_movements')
            ->where('type', 'sale')
            ->where('created_at', '>=', $since)
            ->selectRaw('product_id, SUM(ABS(quantity)) as units')
            ->groupBy('product_id')
            ->pluck('units', 'product_id');

        $products = Product::select('id', 'sku', 'name')->get()->map(function ($p) use ($sold) {
            $units = (int) ($sold[$p->id] ?? 0);
            return ['sku' => $p->sku, 'name' => $p->name, 'units_sold' => $units];
        });

        return [
            'fast_moving' => $products->sortByDesc('units_sold')->take(10)->values(),
            'slow_moving' => $products->where('units_sold', '>', 0)->sortBy('units_sold')->take(10)->values(),
            'dead_stock' => $products->where('units_sold', 0)->take(20)->values(),
        ];
    }

    public function topCustomers(int $limit = 10): array
    {
        // Select name parts separately and join in PHP — portable across MySQL
        // and SQLite (avoids MySQL-only CONCAT / SQLite || differences).
        return Customer::query()
            ->leftJoin('sales_orders', 'sales_orders.customer_id', '=', 'customers.id')
            ->whereNotIn('sales_orders.status', ['draft', 'cancelled'])
            ->selectRaw('customers.id, customers.first_name, customers.last_name,
                COUNT(sales_orders.id) as orders, COALESCE(SUM(sales_orders.grand_total_cents),0) as revenue')
            ->groupBy('customers.id', 'customers.first_name', 'customers.last_name')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'name' => trim("{$r->first_name} {$r->last_name}"),
                'orders' => (int) $r->orders,
                'revenue' => (int) $r->revenue / 100,
            ])
            ->toArray();
    }

    public function topVendors(int $limit = 10): array
    {
        return Vendor::query()
            ->leftJoin('purchase_orders', 'purchase_orders.vendor_id', '=', 'vendors.id')
            ->selectRaw('vendors.id, vendors.name, COUNT(purchase_orders.id) as pos,
                COALESCE(SUM(purchase_orders.grand_total_cents),0) as spend')
            ->groupBy('vendors.id', 'vendors.name')
            ->orderByDesc('spend')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'purchase_orders' => (int) $r->pos, 'spend' => (int) $r->spend / 100])
            ->toArray();
    }

    private function betweenDates($q, ?string $from, ?string $to): void
    {
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }
    }
}
