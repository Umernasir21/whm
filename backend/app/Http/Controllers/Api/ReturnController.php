<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReturnOrder;
use App\Services\ReturnService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReturnController extends Controller
{
    public function __construct(private ReturnService $returns) {}

    public function index(Request $request)
    {
        $q = ReturnOrder::query()->with(['customer:id,first_name,last_name', 'items']);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }

        return $q->latest()->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $d = $request->validate([
            'sales_order_id' => ['nullable', 'exists:sales_orders,id'],
            'customer_id' => ['nullable', 'exists:customers,id'],
            'reason' => ['nullable', Rule::in(['defective', 'damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'other'])],
            'resolution' => ['nullable', Rule::in(['refund', 'replacement', 'store_credit', 'none'])],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_name' => ['required', 'string', 'max:191'],
            'items.*.product_id' => ['nullable', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.condition' => ['nullable', Rule::in(['resellable', 'damaged', 'defective'])],
            'items.*.restock' => ['boolean'],
            'items.*.unit_refund' => ['nullable', 'numeric', 'min:0'],
        ]);

        return response()->json($this->returns->create($d), 201);
    }

    public function show(ReturnOrder $return)
    {
        return $return->load(['items', 'customer', 'salesOrder']);
    }

    /** Advance the RMA through its lifecycle (approve/inspect/restock/refund...). */
    public function updateStatus(Request $request, ReturnOrder $return)
    {
        $d = $request->validate([
            'status' => ['required', Rule::in(['requested', 'approved', 'rejected', 'inspecting', 'restocked', 'refunded', 'replaced', 'closed'])],
            'warehouse_id' => ['nullable', 'exists:warehouses,id'],
        ]);

        return $this->returns->process($return, $d['status'], $d['warehouse_id'] ?? null);
    }
}
