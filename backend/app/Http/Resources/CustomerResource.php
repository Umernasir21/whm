<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'complete_name' => $this->complete_name,
            'company_name' => $this->company_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'buyer_id' => $this->buyer_id,
            'shipping' => [
                'name' => $this->shipping_name,
                'address1' => $this->shipping_address1,
                'address2' => $this->shipping_address2,
                'city' => $this->shipping_city,
                'state' => $this->shipping_state,
                'zip' => $this->shipping_zip,
                'country' => $this->shipping_country,
            ],
            'created_at' => $this->created_at,
        ];
    }
}
