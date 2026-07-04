<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function __construct(private PurchaseOrderService $service) {}

    public function index(Request $request)
    {
        $pos = PurchaseOrder::query()
            ->with('vendor')
            ->status($request->query('status'))
            ->when($request->query('q'), fn ($q, $term) =>
                $q->where('po_number', 'like', "%{$term}%"))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return PurchaseOrderResource::collection($pos);
    }

    public function store(StorePurchaseOrderRequest $request)
    {
        $po = $this->service->create($request->validated());

        return (new PurchaseOrderResource($po))->response()->setStatusCode(201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return new PurchaseOrderResource($purchaseOrder->load(['vendor', 'items', 'receipts.items']));
    }

    /** Approval workflow + status transitions. */
    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        $d = $request->validate([
            'status' => ['sometimes', \Illuminate\Validation\Rule::in(PurchaseOrder::STATUSES)],
            'expected_date' => ['nullable', 'date'],
        ]);

        if (($d['status'] ?? null) === 'approved' && ! $purchaseOrder->approved_at) {
            $purchaseOrder->approved_at = now();
            $purchaseOrder->approved_by = $request->user()->id;
        }
        $purchaseOrder->fill($d)->save();

        return new PurchaseOrderResource($purchaseOrder->fresh(['vendor', 'items']));
    }

    /** Receive stock against this PO (partial or full) → posts to inventory. */
    public function receive(Request $request, PurchaseOrder $purchaseOrder, \App\Services\PurchaseOrderService $service)
    {
        $d = $request->validate([
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'],
            'lines.*.quantity_received' => ['required', 'integer', 'min:0'],
            'lines.*.stock_location_id' => ['nullable', 'exists:stock_locations,id'],
        ]);

        $receipt = $service->receive($purchaseOrder, $d);

        return response()->json($receipt->load('items'), 201);
    }
}
