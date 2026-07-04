<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number', 'sales_order_id', 'issued_date',
        'subtotal_cents', 'tax_cents', 'shipping_cents', 'total_cents', 'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'issued_date' => 'date',
            'subtotal_cents' => Money::class,
            'tax_cents' => Money::class,
            'shipping_cents' => Money::class,
            'total_cents' => Money::class,
        ];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }
}
