<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderItem extends Model
{
    protected $fillable = [
        'sales_order_id', 'product_id', 'product_name', 'condition',
        'line_type', 'quantity', 'unit_cost_cents', 'buy_cost_cents', 'line_total_cents',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost_cents' => Money::class,
            'buy_cost_cents' => Money::class,
            'line_total_cents' => Money::class,
        ];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
