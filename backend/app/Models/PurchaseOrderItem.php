<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id', 'product_id', 'product_name', 'condition',
        'quantity', 'unit_cost_cents', 'tax_cents', 'line_total_cents',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost_cents' => Money::class,
            'tax_cents' => Money::class,
            'line_total_cents' => Money::class,
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
