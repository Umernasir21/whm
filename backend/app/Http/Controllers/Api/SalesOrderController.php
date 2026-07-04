<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSalesOrderRequest;
use App\Http\Requests\UpdateSalesOrderRequest;
use App\Http\Resources\SalesOrderResource;
use App\Models\SalesOrder;
use App\Services\SalesOrderService;
use Illuminate\Http\Request;

class SalesOrderController extends Controller
{
    public function __construct(private SalesOrderService $service) {}

    public function index(Request $request)
    {
        $orders = SalesOrder::query()
            ->with(['customer', 'shipment', 'creator'])
            ->status($request->query('status'))
            ->type($request->query('order_type'))
            ->when($request->query('q'), function ($q, $term) {
                $q->where('so_number', 'like', "%{$term}%")
                  ->orWhere('resource_order_id', 'like', "%{$term}%")
                  ->orWhere('transaction_id', 'like', "%{$term}%")
                  ->orWhereHas('customer', fn ($c) => $c->search($term));
            })
            // Extended search filters (Fig 7):
            ->when($request->query('payment_method'), fn ($q, $m) => $q->where('payment_method', $m))
            ->when($request->query('resource'), fn ($q, $r) => $q->where('resource', $r))
            ->when($request->query('tracking_status'), fn ($q, $s) =>
                $q->whereHas('shipment', fn ($sh) => $sh->where('status', $s)))
            ->when($request->boolean('has_rma'), fn ($q) => $q->whereHas('returns'))
            ->when($request->query('date_from'), fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->query('date_to'), fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return SalesOrderResource::collection($orders);
    }

    public function store(StoreSalesOrderRequest $request)
    {
        $order = $this->service->create($request->validated());

        return (new SalesOrderResource($order))->response()->setStatusCode(201);
    }

    public function show(SalesOrder $salesOrder)
    {
        return new SalesOrderResource(
            $salesOrder->load(['customer', 'items', 'shipment', 'invoice', 'creator'])
        );
    }

    public function update(UpdateSalesOrderRequest $request, SalesOrder $salesOrder)
    {
        $order = $this->service->update($salesOrder, $request->validated());

        return new SalesOrderResource($order);
    }

    public function destroy(SalesOrder $salesOrder)
    {
        abort_unless(request()->user()->hasPermission('sales_orders.delete'), 403);
        $salesOrder->delete();

        return response()->json(['message' => 'Sales order deleted.']);
    }
}
