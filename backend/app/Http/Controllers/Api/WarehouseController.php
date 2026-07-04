<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockLocation;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WarehouseController extends Controller
{
    public function index()
    {
        return Warehouse::withCount(['locations', 'inventoryLevels'])->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        return response()->json(Warehouse::create($this->validated($request)), 201);
    }

    public function show(Warehouse $warehouse)
    {
        return $warehouse->load('locations');
    }

    public function update(Request $request, Warehouse $warehouse)
    {
        $warehouse->update($this->validated($request, $warehouse->id));

        return $warehouse;
    }

    public function destroy(Warehouse $warehouse)
    {
        if ($warehouse->inventoryLevels()->where('quantity_on_hand', '>', 0)->exists()) {
            return response()->json(['message' => 'Cannot delete a warehouse that still holds stock.'], 422);
        }
        $warehouse->delete();

        return response()->noContent();
    }

    /** Nested: stock locations (bins/racks/shelves) for a warehouse. */
    public function storeLocation(Request $request, Warehouse $warehouse)
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:stock_locations,id'],
            'type' => ['required', Rule::in(['zone', 'aisle', 'rack', 'shelf', 'bin'])],
            'code' => ['required', 'string', 'max:48'],
            'label' => ['nullable', 'string', 'max:128'],
            'is_pickable' => ['boolean'],
        ]);
        $data['warehouse_id'] = $warehouse->id;

        return response()->json(StockLocation::create($data), 201);
    }

    private function validated(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:24', Rule::unique('warehouses', 'code')->ignore($id)->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:128'],
            'address1' => ['nullable', 'string', 'max:191'],
            'city' => ['nullable', 'string', 'max:96'],
            'state' => ['nullable', 'string', 'max:96'],
            'zip' => ['nullable', 'string', 'max:24'],
            'country' => ['nullable', 'string', 'max:96'],
            'is_default' => ['boolean'],
            'is_active' => ['boolean'],
        ]);
    }
}
