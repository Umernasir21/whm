<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryLevel;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventory) {}

    /** Real-time stock levels (available = on_hand - reserved). */
    public function index(Request $request)
    {
        $q = InventoryLevel::query()->with(['product:id,sku,name,reorder_point', 'warehouse:id,name', 'location:id,code']);

        if ($request->filled('warehouse_id')) {
            $q->where('warehouse_id', $request->integer('warehouse_id'));
        }
        if ($request->filled('product_id')) {
            $q->where('product_id', $request->integer('product_id'));
        }
        if ($request->boolean('in_stock_only')) {
            $q->where('quantity_on_hand', '>', 0);
        }

        return $q->orderByDesc('quantity_on_hand')->paginate($request->integer('per_page', 25));
    }

    /** Low-stock report: products at/under their reorder point. */
    public function lowStock()
    {
        // Portable correlated subquery (avoids MySQL-only HAVING-without-GROUP-BY).
        $onHandSub = '(SELECT COALESCE(SUM(quantity_on_hand),0) FROM inventory_levels WHERE inventory_levels.product_id = products.id)';

        return Product::query()
            ->where('reorder_point', '>', 0)
            ->withSum('inventoryLevels as on_hand', 'quantity_on_hand')
            ->whereRaw("{$onHandSub} <= products.reorder_point")
            ->orderByRaw("{$onHandSub} ASC")
            ->get(['id', 'sku', 'name', 'reorder_point', 'reorder_quantity']);
    }

    public function movements(Request $request)
    {
        $q = StockMovement::query()->with(['product:id,sku,name', 'warehouse:id,name', 'user:id,name']);

        if ($request->filled('product_id')) {
            $q->where('product_id', $request->integer('product_id'));
        }
        if ($request->filled('type')) {
            $q->where('type', $request->query('type'));
        }

        return $q->latest()->paginate($request->integer('per_page', 30));
    }

    public function receive(Request $request)
    {
        $d = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'stock_location_id' => ['nullable', 'exists:stock_locations,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:191'],
        ]);

        return $this->inventory->receive(
            $d['product_id'], $d['warehouse_id'], $d['stock_location_id'] ?? null,
            $d['quantity'], $d['unit_cost'] ?? 0, 'adjustment_in', null, null, $d['reason'] ?? 'Manual receipt'
        );
    }

    public function adjust(Request $request)
    {
        $d = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'stock_location_id' => ['nullable', 'exists:stock_locations,id'],
            'target_quantity' => ['required', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:191'],
        ]);

        return $this->inventory->adjustTo(
            $d['product_id'], $d['warehouse_id'], $d['stock_location_id'] ?? null,
            $d['target_quantity'], $d['reason'] ?? 'cycle_count'
        );
    }

    public function transfer(Request $request)
    {
        $d = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'from_warehouse_id' => ['required', 'exists:warehouses,id'],
            'from_location_id' => ['nullable', 'exists:stock_locations,id'],
            'to_warehouse_id' => ['required', 'exists:warehouses,id', 'different:from_warehouse_id'],
            'to_location_id' => ['nullable', 'exists:stock_locations,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:191'],
        ]);

        $this->inventory->transfer(
            $d['product_id'], $d['from_warehouse_id'], $d['from_location_id'] ?? null,
            $d['to_warehouse_id'], $d['to_location_id'] ?? null, $d['quantity'], $d['reason'] ?? null
        );

        return response()->json(['message' => 'Transfer completed.']);
    }
}
