<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'carrier' => $this->carrier,
            'tracking_number' => $this->tracking_number,
            'status' => $this->status,
            'ship_from' => [
                'name' => $this->ship_from_name,
                'address' => $this->ship_from_address,
                'city' => $this->ship_from_city,
                'state' => $this->ship_from_state,
                'zip' => $this->ship_from_zip,
            ],
            'shipped_at' => $this->shipped_at,
            'delivered_at' => $this->delivered_at,
        ];
    }
}
