<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'issued_date' => $this->issued_date,
            'subtotal' => $this->subtotal_cents,
            'tax' => $this->tax_cents,
            'shipping' => $this->shipping_cents,
            'total' => $this->total_cents,
            'pdf_url' => $this->pdf_path ? url("/api/invoices/{$this->id}/download") : null,
        ];
    }
}
