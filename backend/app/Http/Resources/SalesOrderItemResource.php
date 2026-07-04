<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->product_name,
            'condition' => $this->condition,
            'line_type' => $this->line_type,
            'quantity' => $this->quantity,
            'unit_cost' => $this->unit_cost_cents,
            'buy_cost' => $this->buy_cost_cents,
            'line_total' => $this->line_total_cents,
        ];
    }
}
