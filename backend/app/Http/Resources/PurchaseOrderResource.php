<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'po_number' => $this->po_number,
            'status' => $this->status,
            'vendor' => $this->whenLoaded('vendor', fn () => [
                'id' => $this->vendor?->id,
                'name' => $this->vendor?->name,
            ]),
            'totals' => [
                'subtotal' => $this->subtotal_cents,
                'tax' => $this->tax_cents,
                'grand_total' => $this->grand_total_cents,
            ],
            'ordered_date' => $this->ordered_date,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => $i->id,
                'product_name' => $i->product_name,
                'condition' => $i->condition,
                'quantity' => $i->quantity,
                'unit_cost' => $i->unit_cost_cents,
                'tax' => $i->tax_cents,
                'line_total' => $i->line_total_cents,
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
