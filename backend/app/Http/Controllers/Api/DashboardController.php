<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\InventoryLevel;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\ReturnOrder;
use App\Models\SalesOrder;
use App\Services\ProfitService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private ProfitService $profit,
        private ReportService $reports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        // Time range (months) for the revenue/profit/AOV figures + chart window.
        $months = max(1, min(24, (int) $request->integer('months', 6)));
        $from = now()->subMonths($months)->startOfMonth()->toDateString();

        $recent = SalesOrder::with('customer')->latest()->limit(8)->get()
            ->map(fn ($o) => [
                'so_number' => $o->so_number,
                'customer' => trim($o->customer?->first_name . ' ' . $o->customer?->last_name),
                'status' => $o->status,
                'total' => $o->grand_total_cents,
                'created_at' => $o->created_at,
            ]);

        // Cross-database month bucket: SUBSTR(datetime,1,7) → 'YYYY-MM' works on
        // both MySQL and SQLite (avoids MySQL-only DATE_FORMAT).
        $trend = SalesOrder::selectRaw("SUBSTR(created_at,1,7) as month, SUM(grand_total_cents) as rev, SUM(profit_cents) as profit, COUNT(*) as orders")
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->where('created_at', '>=', now()->subMonths($months)->startOfMonth())
            ->groupBy('month')->orderBy('month')->get()
            ->map(fn ($r) => [
                'month' => $r->month,
                'revenue' => round($r->rev / 100, 2),
                'profit' => round($r->profit / 100, 2),
                'orders' => (int) $r->orders,
            ]);

        $inventoryValue = (int) InventoryLevel::selectRaw('SUM(quantity_on_hand * avg_cost_cents) as v')->value('v');

        // Correlated-subquery comparisons are portable across MySQL/SQLite
        // (unlike HAVING on a non-grouped aggregate, which SQLite rejects).
        $onHandSub = '(SELECT COALESCE(SUM(quantity_on_hand),0) FROM inventory_levels WHERE inventory_levels.product_id = products.id)';

        $lowStock = Product::where('reorder_point', '>', 0)
            ->whereRaw("{$onHandSub} <= products.reorder_point")->count();

        $outOfStock = Product::where('is_active', true)
            ->whereRaw("{$onHandSub} = 0")->count();

        $lowStockItems = Product::where('reorder_point', '>', 0)
            ->whereRaw("{$onHandSub} <= products.reorder_point")
            ->selectRaw("id, sku, name, reorder_point, {$onHandSub} as on_hand")
            ->orderByRaw("{$onHandSub} ASC")
            ->limit(4)->get()
            ->map(fn ($p) => ['sku' => $p->sku, 'name' => $p->name, 'on_hand' => (int) $p->on_hand, 'reorder_point' => (int) $p->reorder_point]);

        return response()->json([
            'kpis' => [
                'sales_orders' => SalesOrder::count(),
                'purchase_orders' => PurchaseOrder::count(),
                'customers' => Customer::count(),
                'products' => Product::count(),
                'pending_shipments' => SalesOrder::whereIn('status', ['approved', 'confirmed', 'packed', 'ready_to_ship'])->count(),
                'open_returns' => ReturnOrder::whereNotIn('status', ['closed', 'refunded', 'replaced'])->count(),
                'low_stock' => $lowStock,
                'out_of_stock' => $outOfStock,
                'inventory_value' => round($inventoryValue / 100, 2),
            ],
            'profit' => $this->profit->summary(),
            'sales' => $this->reports->salesSummary($from),
            'range_months' => $months,
            'revenue_trend' => $trend,
            'recent_orders' => $recent,
            'top_customers' => $this->reports->topCustomers(5),
            'low_stock_items' => $lowStockItems,
        ]);
    }
}
