<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'so_number' => $this->so_number,
            'order_type' => $this->order_type,
            'status' => $this->status,
            'resource' => $this->resource,
            'resource_order_id' => $this->resource_order_id,
            'alternate_id' => $this->alternate_id,
            'payment' => [
                'method' => $this->payment_method,
                'transaction_id' => $this->transaction_id,
                'date' => $this->payment_date,
                'comment' => $this->payment_comment,
            ],
            'totals' => [
                'subtotal' => $this->subtotal_cents,        // Product Total
                'shipping' => $this->shipping_cents,
                'tax' => $this->tax_cents,
                'grand_total' => $this->grand_total_cents,
                // Cost basis (Fig 1–2):
                'po_before_tax' => $this->cost_of_goods_cents,
                'po_after_tax' => round($this->cost_of_goods_cents + $this->buy_tax_cents, 2),
                'profit' => $this->profit_cents,
            ],
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'items' => SalesOrderItemResource::collection($this->whenLoaded('items')),
            'shipment' => new ShipmentResource($this->whenLoaded('shipment')),
            'invoice' => new InvoiceResource($this->whenLoaded('invoice')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
